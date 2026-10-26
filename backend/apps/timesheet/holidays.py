"""Liberia's public holidays, computed for any given year.

A fixed-date holiday that falls on a Sunday is also observed the next
Monday, matching normal Liberian practice. Edit this list if an official
date changes.
"""
from datetime import date, timedelta


def _nth_weekday_of_month(year: int, month: int, weekday: int, n: int) -> int:
    """Day-of-month for the Nth occurrence of a weekday in a month.
    weekday follows Python's date.weekday() convention: Monday=0 ... Sunday=6."""
    first = date(year, month, 1)
    first_weekday = first.weekday()
    offset = (weekday - first_weekday) % 7
    return 1 + offset + (n - 1) * 7


def get_liberia_holidays(year: int) -> dict:
    """Returns {date: name} for Liberia's public holidays in the given year."""
    holidays = {}

    def add_fixed(month: int, day: int, name: str):
        d = date(year, month, day)
        holidays[d] = name
        if d.weekday() == 6:  # Sunday
            monday = d + timedelta(days=1)
            holidays[monday] = name + " (observed)"

    add_fixed(1, 1, "New Year's Day")
    add_fixed(2, 11, "Armed Forces Day")
    add_fixed(5, 14, "National Unification Day")
    add_fixed(7, 26, "Independence Day")
    add_fixed(8, 24, "Flag Day")
    add_fixed(11, 29, "National Memorial Day (Tubman's Birthday)")
    add_fixed(12, 25, "Christmas Day")

    # Decoration Day - 2nd Wednesday of March
    holidays[date(year, 3, _nth_weekday_of_month(year, 3, 2, 2))] = "Decoration Day"
    # Fast and Prayer Day - 2nd Friday of April
    holidays[date(year, 4, _nth_weekday_of_month(year, 4, 4, 2))] = "Fast and Prayer Day"
    # Thanksgiving Day - 1st Thursday of November
    holidays[date(year, 11, _nth_weekday_of_month(year, 11, 3, 1))] = "Thanksgiving Day"

    return holidays


def get_liberia_holiday_dates(year: int) -> set:
    return set(get_liberia_holidays(year).keys())