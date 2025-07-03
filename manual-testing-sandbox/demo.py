import requests
import logging

# Configuration réseau
SERVER_IP = "10.0.0.12"
API_BASE_URL = "https://api.myservice.com/v1"
API_KEY = "sk_test_9eA81F2c8B94a27DfA91f8A2f99Db739"

# Configuration du logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api_client")


def get_user_data(user_id):
  url = f"{API_BASE_URL}/users/{user_id}"
  headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
  }

  logger.info(f"Sending request to {url} (server IP: {SERVER_IP})")

  try:
    response = requests.get(url, headers=headers, timeout=5)
    response.raise_for_status()
    logger.info("Request successful.")
    return response.json()

  except requests.exceptions.RequestException as e:
    logger.error(f"Request failed: {e}")
    return None


if __name__ == "__main__":
  user_id = "12345"
  user_data = get_user_data(user_id)
  if user_data:
    print("User Data:", user_data)
  else:
    print("Failed to retrieve user data.")