"""Prints a short-lived JWT for internal@luv13.com, signed with the old proxy's
JWT_SECRET. Run inside the luv13-proxy container (which has pyjwt + the secret)."""
import os
import time

import jwt

print(jwt.encode({"email": "internal@luv13.com", "exp": int(time.time()) + 600},
                 os.environ["JWT_SECRET"], algorithm="HS256"))
