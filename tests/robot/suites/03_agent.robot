*** Settings ***
Resource          ../resources/common.resource
Suite Setup       Run Keywords    Open App    AND    Login As Agent
Suite Teardown    Run Keywords    Logout And Close    AND    Close Browser

*** Test Cases ***

Agent Dashboard Loads
    Navigate To    /dashboard
    Wait For Load State    networkidle    timeout=20s
    ${url}=    Get Url
    Should Contain    ${url}    /dashboard
    Take Test Screenshot    agent_dashboard

Agent Loans Page Loads
    Navigate To    /loans
    Wait For Elements State    h1    visible
    Take Test Screenshot    agent_loans

Agent Loans Shows Request Loan Button
    Navigate To    /loans
    Wait For Elements State    role=button[name="Request Loan"]    visible
    Take Test Screenshot    agent_loans_request_button

Agent Can Open Request Loan Dialog
    Navigate To    /loans
    Click    role=button[name="Request Loan"]
    Wait For Elements State    css=[role="dialog"]    visible    timeout=10s
    Take Test Screenshot    agent_request_loan_dialog
    Keyboard Key    press    Escape

Agent Request Loan Dialog Has Mode Toggle
    Navigate To    /loans
    Click    role=button[name="Request Loan"]
    Wait For Elements State    text=Existing Customer    visible    timeout=10s
    Wait For Elements State    text=New Customer    visible
    Take Test Screenshot    agent_request_loan_mode_toggle
    Keyboard Key    press    Escape

Agent Collections Page Loads
    Navigate To    /collections
    Wait For Elements State    h1    visible
    Take Test Screenshot    agent_collections

Agent Collections Record Button Visible
    Navigate To    /collections
    Wait For Elements State    role=button[name="Record Collection"]    visible
    Take Test Screenshot    agent_collections_record_button

Agent Customers Page Loads
    Navigate To    /customers
    Wait For Elements State    h1    visible
    Take Test Screenshot    agent_customers

Agent Customers Shows Outstanding Column
    Navigate To    /customers
    Wait For Elements State    text=Outstanding    visible
    Take Test Screenshot    agent_customers_outstanding

Agent Attendance Page Loads
    Navigate To    /attendance
    Wait For Elements State    h1    visible
    Take Test Screenshot    agent_attendance

Agent Reconciliation Page Loads
    Navigate To    /reconciliation
    Wait For Elements State    h1    visible
    Take Test Screenshot    agent_reconciliation

Agent Notification Bell Visible
    Navigate To    /dashboard
    Wait For Load State    networkidle
    # Bell button — use nth=0 to avoid strict mode (multiple buttons on page)
    Wait For Elements State    css=div.relative > button >> nth=0    visible    timeout=10s
    Take Test Screenshot    agent_notification_bell

Agent Cannot Access Admin Pages
    Navigate To    /admin/customers
    Wait For Load State    networkidle
    ${url}=    Get Url
    Should Not Contain    ${url}    /admin/customers
    Take Test Screenshot    agent_admin_blocked
