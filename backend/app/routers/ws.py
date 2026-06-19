from fastapi import WebSocket, APIRouter, Depends
from ..main import ws_manager

router = APIRouter()

@router.websocket('/ws/updates')
async def websocket_updates(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            # keep connection alive; server pushes updates
            await ws.receive_text()
    except Exception:
        ws_manager.disconnect(ws)
