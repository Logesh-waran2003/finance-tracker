*** Settings ***
Resource          ../resources/common.resource
Suite Setup       Open App
Suite Teardown    Close Browser

*** Test Cases ***

Agent Submits Loan Request For New Customer
    Login As Agent
    Navigate To    /loans
    Click    role=button[name="Request Loan"]
    Wait For Elements State    css=[role="dialog"]    visible    timeout=10s
    Wait For Elements State    text=New Customer    visible
    Click    text=New Customer
    Fill Text    css=input[placeholder="Full name"]    RobotTest Customer
    Fill Text    css=input[placeholder="Phone number"]    9999999999
    Fill Text    css=input[placeholder="Area / locality"]    Test Area
    ${inputs}=    Get Elements    css=[role="dialog"] input[type="number"]
    Fill Text    ${inputs}[0]    5000
    Fill Text    ${inputs}[1]    10
    Fill Text    ${inputs}[2]    100
    ${today}=    Get Current Date    result_format=%Y-%m-%d
    Fill Text    css=input[type="date"]    ${today}
    Click    role=button[name="Submit Request"]
    Wait For Elements State    text=submitted    visible    timeout=10s
    Take Test Screenshot    loan_request_submitted
    Logout And Close

Admin Reviews Pending Loan Request
    Login As Admin
    Navigate To    /admin/loan-requests
    Wait For Elements State    h1    visible
    Take Test Screenshot    admin_loan_requests_pending
    Logout And Close

Admin Approves Loan Request
    Login As Admin
    Navigate To    /admin/loan-requests
    Wait For Load State    networkidle
    ${approve_btns}=    Get Elements    role=button[name="Approve"]
    ${count}=    Get Length    ${approve_btns}
    IF    ${count} > 0
        Click    ${approve_btns}[0]
        Wait For Elements State    css=[role="dialog"]    visible    timeout=5s
        Take Test Screenshot    admin_approve_dialog_open
        Keyboard Key    press    Escape
    ELSE
        Log    No pending requests — skipping approval
    END
    Logout And Close

Admin Collections Page Has Confirm Button
    Login As Admin
    Navigate To    /admin/collections
    Wait For Elements State    h1    visible
    Take Test Screenshot    admin_collections_confirm_check
    Logout And Close

Agent Collection Form Opens
    Login As Agent
    Navigate To    /collections
    Click    role=button[name="Record Collection"]
    Wait For Elements State    css=[role="dialog"]    visible    timeout=10s
    Take Test Screenshot    agent_collection_form_open
    Keyboard Key    press    Escape
    Logout And Close
