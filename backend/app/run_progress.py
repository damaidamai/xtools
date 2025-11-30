from __future__ import annotations

from typing import Dict, Optional, Tuple

_progress: Dict[int, Tuple[Optional[int], int]] = {}
_stops: Dict[int, bool] = {}


def set_progress(run_id: int, total: Optional[int], processed: int) -> None:
    """Set progress for a run. `total` can be None if unknown."""
    _progress[run_id] = (total, processed)


def increment_progress(run_id: int, processed_delta: int, total: Optional[int] = None) -> None:
    total_now, processed_now = _progress.get(run_id, (total, 0))
    if total is not None:
        total_now = total
    processed_now += processed_delta
    _progress[run_id] = (total_now, processed_now)


def clear_progress(run_id: int) -> None:
    _progress.pop(run_id, None)


def get_progress(run_id: int) -> Tuple[Optional[int], int]:
    return _progress.get(run_id, (None, 0))


def request_stop(run_id: int) -> None:
    _stops[run_id] = True


def clear_stop(run_id: int) -> None:
    _stops.pop(run_id, None)


def is_stopped(run_id: int) -> bool:
    return _stops.get(run_id, False)
