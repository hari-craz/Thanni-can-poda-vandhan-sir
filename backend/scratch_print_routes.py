import sys
import os
sys.path.insert(0, os.path.abspath("."))
from app.main import app

for route in app.routes:
    print(f"Path: {route.path} | Methods: {route.methods} | Name: {route.name}")
