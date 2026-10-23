import pytest

from app.services.metrics import latency_stats, percentile, review_status


def test_percentile_empty_is_none():
    assert percentile([], 95) is None


def test_percentile_nearest_rank_20_values():
    assert percentile(list(range(1, 21)), 95) == 19


def test_percentile_nearest_rank_100_values():
    assert percentile(list(range(1, 101)), 95) == 95


def test_percentile_single_value():
    assert percentile([700], 95) == 700


def test_percentile_unsorted_input():
    assert percentile([5, 1, 4, 2, 3], 95) == 5


def test_latency_stats_empty_is_none_not_zero():
    assert latency_stats([]) == {"count": 0, "avg_ms": None, "p95_ms": None, "max_ms": None}


def test_latency_stats_values():
    assert latency_stats([1000, 2000, 3000]) == {
        "count": 3,
        "avg_ms": 2000,
        "p95_ms": 3000,
        "max_ms": 3000,
    }


def test_latency_stats_ignores_none():
    assert latency_stats([None, 1000, None, 2000])["count"] == 2


@pytest.mark.parametrize(
    "total,open_count,expected",
    [(0, 0, "clean"), (3, 3, "unreviewed"), (3, 0, "reviewed"), (3, 1, "in_review")],
)
def test_review_status(total, open_count, expected):
    assert review_status(total, open_count) == expected
