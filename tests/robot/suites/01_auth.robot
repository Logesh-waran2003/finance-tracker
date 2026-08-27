*** Settings ***
Resource          ../resources/common.resource
Suite Setup       Open App
Suite Teardown    Close Browser

*** Test Cases ***

Admin Login Valid Credentials
    Login As Admin
    ${url}=    Get Url
    Should Not Contain    ${url}    /login
    Take Test Screenshot    login_admin_success
    Logout And Close

Admin Login Invalid Password
    New Context    viewport={'width': 1280, 'height': 800}
    New Page       ${BASE_URL}/login
    Wait For Elements State    id=email    visible
    Fill Text    id=email    ${ADMIN_EMAIL}
    Fill Text    id=password    wrongpassword
    Click    css=button[type="submit"]
    Wait For Elements State    text=Invalid email or password    visible    timeout=10s
    Take Test Screenshot    login_invalid_password
    Close Context

Agent Login Valid Credentials
    Login As Agent
    ${url}=    Get Url
    Should Not Contain    ${url}    /login
    Take Test Screenshot    login_agent_success
    Logout And Close

Authenticated User Redirected From Login
    Login As Agent
    Go To    ${BASE_URL}/login
    Wait For Load State    networkidle
    ${url}=    Get Url
    Should Not Contain    ${url}    /login
    Take Test Screenshot    login_redirect_already_auth
    Logout And Close

Logout Works
    Login As Admin
    Logout And Close
    # After signout, new page should show login
    New Context    viewport={'width': 1280, 'height': 800}
    New Page       ${BASE_URL}
    Wait For Load State    networkidle
    ${url}=    Get Url
    Should Contain    ${url}    /login
    Take Test Screenshot    logout_success
    Close Context
