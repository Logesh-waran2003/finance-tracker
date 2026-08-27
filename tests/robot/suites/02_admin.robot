*** Settings ***
Resource          ../resources/common.resource
Suite Setup       Run Keywords    Open App    AND    Login As Admin
Suite Teardown    Run Keywords    Logout And Close    AND    Close Browser

*** Test Cases ***

Admin Dashboard Loads
    Navigate To    /dashboard
    Wait For Elements State    h1    visible
    Take Test Screenshot    admin_dashboard

Admin Dashboard Period Toggle Daily
    Navigate To    /dashboard
    Click    role=button[name="Daily"]
    Wait For Load State    networkidle
    Take Test Screenshot    admin_dashboard_daily

Admin Dashboard Period Toggle Monthly
    Navigate To    /dashboard
    Click    role=button[name="Monthly"]
    Wait For Load State    networkidle
    Take Test Screenshot    admin_dashboard_monthly

Admin Dashboard Period Toggle Yearly
    Navigate To    /dashboard
    Click    role=button[name="Yearly"]
    Wait For Load State    networkidle
    Take Test Screenshot    admin_dashboard_yearly

Admin Customers Page Loads
    Navigate To    /admin/customers
    Wait For Elements State    h1    visible
    Take Test Screenshot    admin_customers

Admin Loans Page Loads
    Navigate To    /admin/loans
    Wait For Elements State    h1    visible
    Take Test Screenshot    admin_loans

Admin Collections Page Loads
    Navigate To    /admin/collections
    Wait For Elements State    h1    visible
    Take Test Screenshot    admin_collections

Admin Loan Requests Page Loads
    Navigate To    /admin/loan-requests
    Wait For Elements State    h1    visible
    Take Test Screenshot    admin_loan_requests

Admin Attendance Page Loads
    Navigate To    /admin/attendance
    Wait For Elements State    h1    visible
    Take Test Screenshot    admin_attendance

Admin Reconciliation Page Loads
    Navigate To    /admin/reconciliation
    Wait For Elements State    h1    visible
    Take Test Screenshot    admin_reconciliation

Admin Reports Page Loads
    Navigate To    /admin/reports
    Wait For Elements State    h1    visible
    Take Test Screenshot    admin_reports

Admin Notification Bell Visible
    Navigate To    /dashboard
    Wait For Load State    networkidle
    # Bell button — use nth=0 to avoid strict mode
    Wait For Elements State    css=div.relative > button >> nth=0    visible    timeout=10s
    Take Test Screenshot    admin_notification_bell

Admin Can Open Create Loan Dialog
    Navigate To    /admin/loans
    Click    role=button[name="Create Loan"]
    # Just verify the dialog opened — it has multiple labels inside, don't assert on a specific one
    Wait For Elements State    css=[role="dialog"]    visible    timeout=10s
    Take Test Screenshot    admin_create_loan_dialog
    Keyboard Key    press    Escape
