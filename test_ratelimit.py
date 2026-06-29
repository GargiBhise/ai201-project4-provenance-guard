import requests

url = "http://127.0.0.1:5000/submit"
payload = {
    "text": "This is a test submission for rate limit testing purposes only.",
    "creator_id": "ratelimit-test"
}

for i in range(1, 13):
    r = requests.post(url, json=payload)
    print(f"Request {i}: {r.status_code}")