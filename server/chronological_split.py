"""Shared cutoff for fair, chronological candidate/incumbent comparisons."""
from datetime import date, timedelta

def evaluation_cutoff(through, incumbent_through=None):
    end=date.fromisoformat(through)
    default=end-timedelta(days=30)
    if incumbent_through is None:
        return default.isoformat()
    incumbent=date.fromisoformat(incumbent_through)
    if incumbent>end:
        raise ValueError('Incumbent training date exceeds the completed archive')
    # Both models may learn from all outcomes already available to the
    # incumbent. Every evaluated outcome must remain strictly later.
    return max(default,incumbent).isoformat()
