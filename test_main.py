import os
import json
import unittest
from typing import Any
from unittest.mock import patch

from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.main import _parse_json_object, app, normalize_tavily_result, settings


class FakeResponse:
    def __init__(self, body: dict, status_code: int = 200) -> None:
        self._body = body
        self.status_code = status_code
        self.is_error = status_code >= 400

    def json(self) -> dict:
        return self._body


class FakeAsyncClient:
    def __init__(self, response: FakeResponse | list[FakeResponse]) -> None:
        self.responses = response if isinstance(response, list) else [response]
        self.requests: list[dict[str, Any]] = []

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    async def post(self, *args: object, **kwargs: object) -> FakeResponse:
        self.requests.append(kwargs)
        return self.responses.pop(0)


class IntegrationStatusTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_endpoint(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_status_reports_unconfigured_providers(self) -> None:
        with patch.dict(os.environ, {
            "TAVILY_API_KEY": "",
            "NEBIUS_API_KEY": "",
            "NEBIUS_BASE_URL": "",
            "NEBIUS_MODEL": "",
        }, clear=False):
            status = settings.integration_status()
        self.assertFalse(status["tavily"]["ok"])
        self.assertFalse(status["nebius"]["ok"])

    def test_status_reports_nebius_configuration_without_exposing_key(self) -> None:
        with patch.dict(os.environ, {
            "NEBIUS_API_KEY": "secret-test-value",
            "NEBIUS_BASE_URL": "https://provider.example/v1",
            "NEBIUS_MODEL": "test-model",
        }, clear=False):
            status = settings.integration_status()
        self.assertTrue(status["nebius"]["ok"])
        self.assertEqual(status["nebius"]["model"], "test-model")
        self.assertNotIn("secret-test-value", str(status))

    def test_cors_allows_vite_fallback_dev_port(self) -> None:
        response = self.client.options("/api/search", headers={
            "Origin": "http://127.0.0.1:5174",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], "http://127.0.0.1:5174")

    def test_search_returns_actionable_configuration_error(self) -> None:
        with patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            response = self.client.post("/api/search", json={"query": "Python internships"})
        self.assertEqual(response.status_code, 503)
        self.assertIn("TAVILY_API_KEY", response.json()["detail"])

    def test_generation_returns_configuration_error_without_credentials(self) -> None:
        with patch.dict(os.environ, {
            "NEBIUS_API_KEY": "",
            "NEBIUS_BASE_URL": "",
            "NEBIUS_MODEL": "",
        }, clear=False):
            response = self.client.post("/api/generate/explanation", json={
                "profile": {},
                "job": {},
                "match": {},
            })
        self.assertEqual(response.status_code, 503)
        self.assertIn("NEBIUS_API_KEY", response.json()["detail"])

    def test_search_normalizes_provider_results(self) -> None:
        provider_response = FakeResponse({"results": [{
            "title": "Python Intern at Example Labs",
            "url": "https://jobs.example.org/python-intern",
            "content": "Use Python and FastAPI.",
            "published_date": "2026-10-12",
        }]})
        with (
            patch.dict(os.environ, {"TAVILY_API_KEY": "test-key"}, clear=False),
            patch("app.main.httpx.AsyncClient", return_value=FakeAsyncClient(provider_response)),
        ):
            response = self.client.post("/api/search", json={"query": "Python internships"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["provider"], "tavily")
        self.assertEqual(response.json()["results"][0]["sourceUrl"], "https://jobs.example.org/python-intern")

    def test_material_generation_uses_nebius_response(self) -> None:
        materials = {
            "cover": "Cover",
            "recruiter": "Message",
            "email": "Email",
            "highlights": "Highlights",
            "interview": "Interview",
        }
        provider_response = FakeResponse({"choices": [{
            "message": {"content": json.dumps(materials)},
        }]})
        fake_client = FakeAsyncClient(provider_response)
        with (
            patch.dict(os.environ, {
                "NEBIUS_API_KEY": "test-key",
                "NEBIUS_BASE_URL": "https://provider.example/v1",
                "NEBIUS_MODEL": "test-model",
            }, clear=False),
            patch("app.main.httpx.AsyncClient", return_value=fake_client),
        ):
            response = self.client.post("/api/generate/materials", json={
                "profile": {"name": "Candidate"},
                "job": {"role": "Python Intern"},
                "match": {},
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["materials"], materials)
        self.assertEqual(
            fake_client.requests[0]["headers"]["Authorization"],
            "Bearer test-key",
        )
        self.assertEqual(
            fake_client.requests[0]["json"]["response_format"],
            {"type": "json_object"},
        )

    def test_nebius_authentication_errors_are_actionable(self) -> None:
        fake_client = FakeAsyncClient(FakeResponse({"error": "unauthorized"}, status_code=401))
        with (
            patch.dict(os.environ, {
                "NEBIUS_API_KEY": "test-key",
                "NEBIUS_BASE_URL": "https://provider.example/v1",
                "NEBIUS_MODEL": "test-model",
            }, clear=False),
            patch("app.main.httpx.AsyncClient", return_value=fake_client),
        ):
            response = self.client.post("/api/generate/materials", json={
                "profile": {},
                "job": {},
                "match": {},
            })
        self.assertEqual(response.status_code, 502)
        self.assertIn("Check NEBIUS_API_KEY", response.json()["detail"])

    def test_material_generation_retries_without_unsupported_json_mode(self) -> None:
        materials = {
            "cover": "Cover",
            "recruiter": "Message",
            "email": "Email",
            "highlights": "Highlights",
            "interview": "Interview",
        }
        fake_client = FakeAsyncClient([
            FakeResponse({"error": {"message": "response_format json_object is not supported"}}, status_code=400),
            FakeResponse({"choices": [{"message": {"content": json.dumps(materials)}}]}),
        ])
        with (
            patch.dict(os.environ, {
                "NEBIUS_API_KEY": "test-key",
                "NEBIUS_BASE_URL": "https://provider.example/v1",
                "NEBIUS_MODEL": "test-model",
            }, clear=False),
            patch("app.main.httpx.AsyncClient", return_value=fake_client),
        ):
            response = self.client.post("/api/generate/materials", json={
                "profile": {},
                "job": {},
                "match": {},
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["materials"], materials)
        self.assertIn("response_format", fake_client.requests[0]["json"])
        self.assertNotIn("response_format", fake_client.requests[1]["json"])


class ModelOutputParsingTests(unittest.TestCase):
    def test_parses_plain_json(self) -> None:
        self.assertEqual(_parse_json_object('{"cover":"draft"}'), {"cover": "draft"})

    def test_parses_json_surrounded_by_explanation_and_markdown_fence(self) -> None:
        output = 'Here are the drafts:\n```json\n{"cover":"draft","email":"mail"}\n```\nDone.'
        self.assertEqual(_parse_json_object(output), {"cover": "draft", "email": "mail"})

    def test_parses_json_with_trailing_commas(self) -> None:
        self.assertEqual(
            _parse_json_object('{"cover":"draft","items":["one",]}'),
            {"cover": "draft", "items": ["one"]},
        )

    def test_does_not_remove_commas_inside_string_values(self) -> None:
        self.assertEqual(
            _parse_json_object('{"cover":"keep ,} inside text","email":"mail",}'),
            {"cover": "keep ,} inside text", "email": "mail"},
        )

    def test_reports_unparseable_output(self) -> None:
        with self.assertRaises(HTTPException) as error:
            _parse_json_object("I could not generate the requested drafts.")
        self.assertEqual(error.exception.status_code, 502)
        self.assertIn("could not be parsed as a JSON object", error.exception.detail)


class TavilyNormalizationTests(unittest.TestCase):
    def test_result_has_frontend_job_shape_and_real_source_url(self) -> None:
        job = normalize_tavily_result({
            "title": "Python Machine Learning Intern at Example Labs",
            "url": "https://jobs.listing-board.net/intern",
            "content": "Remote role in Hyderabad. Use Python, PyTorch, and FastAPI.",
            "published_date": "2026-10-12",
        }, "Python internship")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job["role"], "Python Machine Learning Intern at Example Labs")
        self.assertEqual(job["sourceUrl"], "https://jobs.listing-board.net/intern")
        self.assertIsNone(job["applyUrl"])
        self.assertFalse(job["isOfficialApply"])
        self.assertEqual(job["city"], "Hyderabad")
        self.assertEqual(job["mode"], "Remote")
        self.assertEqual(job["posted"], "2026-10-12")
        self.assertIn("Python", job["required"])
        self.assertFalse(job["_sample"])

    def test_marks_company_career_domain_as_official_apply_link(self) -> None:
        job = normalize_tavily_result({
            "title": "Machine Learning Intern at Acme",
            "url": "https://careers.acme.com/jobs/ml-intern",
            "content": "Join Acme as a Machine Learning Intern.",
        }, "Acme internships")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertTrue(job["isOfficialApply"])
        self.assertEqual(job["applyUrl"], "https://careers.acme.com/jobs/ml-intern")

    def test_marks_company_named_ats_posting_as_official_apply_link(self) -> None:
        job = normalize_tavily_result({
            "title": "Software Engineering Intern at Acme Labs",
            "url": "https://jobs.lever.co/acme-labs/123",
            "content": "Acme Labs is hiring a Software Engineering Intern.",
        }, "Acme Labs internships")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertTrue(job["isOfficialApply"])
        self.assertEqual(job["applyUrl"], "https://jobs.lever.co/acme-labs/123")

    def test_does_not_mark_generic_job_board_as_official(self) -> None:
        job = normalize_tavily_result({
            "title": "Software Engineering Intern at Acme",
            "url": "https://www.indeed.com/viewjob?jk=123",
            "content": "Acme is hiring a Software Engineering Intern.",
        }, "Acme internships")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertFalse(job["isOfficialApply"])
        self.assertIsNone(job["applyUrl"])

    def test_does_not_mistake_job_board_name_for_the_employer(self) -> None:
        job = normalize_tavily_result({
            "title": "Machine Learning Internship Jobs in Hyderabad - Naukri.com",
            "url": "https://www.naukri.com/machine-learning-intern-jobs",
            "content": "Browse internship listings from multiple employers.",
        }, "Machine Learning internship")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertFalse(job["isOfficialApply"])
        self.assertIsNone(job["applyUrl"])

    def test_recognizes_employer_suffix_in_post_title(self) -> None:
        job = normalize_tavily_result({
            "title": "Machine Learning Engineering Internship - Cisco",
            "url": "https://jobs.cisco.com/jobs/123",
            "content": "Machine Learning Engineering Internship in Hyderabad.",
        }, "Machine Learning internship")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job["company"], "Cisco")
        self.assertTrue(job["isOfficialApply"])

    def test_missing_publish_date_is_not_fabricated(self) -> None:
        job = normalize_tavily_result({
            "title": "Intern",
            "url": "https://jobs.example.org/intern",
            "content": "Apply for this internship.",
        }, "internship")
        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job["posted"], "Not listed")

    def test_rejects_non_http_and_empty_results(self) -> None:
        self.assertIsNone(normalize_tavily_result({
            "title": "Unsafe result",
            "url": "javascript:alert(1)",
            "content": "Internship",
        }, "internship"))
        self.assertIsNone(normalize_tavily_result({
            "url": "https://example.org",
            "title": "",
            "content": "",
        }, "internship"))


if __name__ == "__main__":
    unittest.main()
