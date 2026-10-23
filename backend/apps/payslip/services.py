from decimal import Decimal

from django.db import transaction

from apps.payroll.models import PayrollConfiguration, StatutoryScheme, TaxBracket
from apps.timesheet.models import Timesheet

from .models import Payslip


class PayslipGenerationError(Exception):
    """Raised when a Payslip cannot be generated for a Timesheet. Views catch
    this and turn it into a 400 response."""


def _active_schemes(organisation, as_of_date):
    return StatutoryScheme.objects.filter(
        organisation=organisation, is_active=True, effective_date__lte=as_of_date
    )


def _active_tax_brackets(organisation, as_of_date):
    return TaxBracket.objects.filter(
        organisation=organisation, is_active=True, effective_date__lte=as_of_date
    ).order_by('lower_bound')


def _calculate_tax(taxable_income, brackets):
    total_tax = Decimal('0')
    breakdown = []
    for bracket in brackets:
        lower = bracket.lower_bound
        upper = bracket.upper_bound
        if taxable_income <= lower:
            continue
        upper_eff = upper if upper is not None else taxable_income
        taxable_in_bracket = min(upper_eff, taxable_income) - lower
        if taxable_in_bracket <= 0:
            continue
        tax_amount = (taxable_in_bracket * bracket.rate / Decimal('100')).quantize(Decimal('0.01'))
        total_tax += tax_amount
        breakdown.append({
            'lower_bound': str(lower),
            'upper_bound': str(upper) if upper is not None else None,
            'rate': str(bracket.rate),
            'taxable_amount': str(taxable_in_bracket),
            'tax_amount': str(tax_amount),
        })
    return total_tax, breakdown


@transaction.atomic
def generate_payslip(timesheet: Timesheet) -> Payslip:
    if timesheet.status != Timesheet.Status.APPROVED:
        raise PayslipGenerationError('Only an approved Timesheet can generate a Payslip.')

    if hasattr(timesheet, 'payslip'):
        raise PayslipGenerationError('A Payslip has already been generated for this Timesheet.')

    organisation = timesheet.organisation
    user = timesheet.user

    try:
        config = organisation.payroll_configuration
    except PayrollConfiguration.DoesNotExist:
        raise PayslipGenerationError(
            'This organisation has no Payroll Configuration set up yet. Set it up first.'
        )

    gross_pay = user.base_salary

    schemes = list(_active_schemes(organisation, timesheet.period_end))
    statutory_employee_total = Decimal('0')
    statutory_employer_total = Decimal('0')
    scheme_breakdown = []
    for scheme in schemes:
        employee_amount = (gross_pay * scheme.employee_rate / Decimal('100')).quantize(Decimal('0.01'))
        employer_amount = (gross_pay * scheme.employer_rate / Decimal('100')).quantize(Decimal('0.01'))
        statutory_employee_total += employee_amount
        statutory_employer_total += employer_amount
        scheme_breakdown.append({
            'name': scheme.name,
            'employee_rate': str(scheme.employee_rate),
            'employer_rate': str(scheme.employer_rate),
            'employee_amount': str(employee_amount),
            'employer_amount': str(employer_amount),
        })

    taxable_income = gross_pay - statutory_employee_total
    brackets = list(_active_tax_brackets(organisation, timesheet.period_end))
    total_tax, tax_breakdown = _calculate_tax(taxable_income, brackets)

    total_deductions = statutory_employee_total + total_tax
    net_pay = gross_pay - total_deductions

    payslip = Payslip.objects.create(
        user=user,
        organisation=organisation,
        timesheet=timesheet,
        period_start=timesheet.period_start,
        period_end=timesheet.period_end,
        currency=config.currency,
        pay_frequency=config.pay_frequency,
        gross_pay=gross_pay,
        total_statutory_employee=statutory_employee_total,
        total_statutory_employer=statutory_employer_total,
        total_tax=total_tax,
        total_deductions=total_deductions,
        net_pay=net_pay,
        breakdown={
            'statutory_schemes': scheme_breakdown,
            'tax_brackets': tax_breakdown,
        },
    )
    return payslip


def toggle_privacy(payslip: Payslip, hidden: bool) -> Payslip:
    payslip.hidden_by_employee = hidden
    payslip.save(update_fields=['hidden_by_employee', 'updated_at'])
    return payslip
