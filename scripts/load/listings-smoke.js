import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1000"],
  },
};

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";

export default function listingsSmoke() {
  const bbox = "18.0,-34.5,19.0,-33.5";
  const listResponse = http.get(`${baseUrl}/api/listings?bbox=${bbox}`);
  check(listResponse, {
    "listings status below 500": (response) => response.status < 500,
    "listings has request id": (response) => Boolean(response.headers["X-Request-Id"]),
  });

  const detailResponse = http.get(`${baseUrl}/api/listings/00000000-0000-0000-0000-000000000000`);
  check(detailResponse, {
    "detail status expected": (response) => [404, 429].includes(response.status),
  });

  sleep(1);
}
