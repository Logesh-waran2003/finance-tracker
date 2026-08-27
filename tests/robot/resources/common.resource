*** Settings ***
Library           Browser    timeout=15s
Library           String
Library           Collections
Library           DateTime

*** Variables ***
${BASE_URL}       http://192.168.0.109:3001
${ADMIN_EMAIL}    admin@demo.com
${ADMIN_PASS}     Demo@1234
${AGENT_EMAIL}    agent@demo.com
${AGENT_PASS}     Demo@1234
${BROWSER}        chromium
${HEADLESS}       True

*** Keywords ***
Open App
    New Browser    browser=${BROWSER}    headless=${HEADLESS}

Close App
    Close Browser

Login As Admin
    New Context    viewport={'width': 1280, 'height': 800}
    New Page       ${BASE_URL}/login
    Wait For Elements State    id=email    visible    timeout=15s
    Fill Text    id=email    ${ADMIN_EMAIL}
    Fill Text    id=password    ${ADMIN_PASS}
    Click    css=button[type="submit"]
    Wait For Load State    networkidle    timeout=15s
    ${url}=    Get Url
    Should Not Contain    ${url}    /login

Login As Agent
    New Context    viewport={'width': 1280, 'height': 800}
    New Page       ${BASE_URL}/login
    Wait For Elements State    id=email    visible    timeout=15s
    Fill Text    id=email    ${AGENT_EMAIL}
    Fill Text    id=password    ${AGENT_PASS}
    Click    css=button[type="submit"]
    Wait For Load State    networkidle    timeout=15s
    ${url}=    Get Url
    Should Not Contain    ${url}    /login

Logout And Close
    Go To    ${BASE_URL}/api/auth/signout
    Wait For Load State    networkidle
    Close Context

Navigate To
    [Arguments]    ${path}
    Go To    ${BASE_URL}${path}
    Wait For Load State    networkidle

Page Should Show
    [Arguments]    ${text}
    Wait For Elements State    css=h1,h2    visible    timeout=10s
    Get Text    css=h1    contains    ${text}

Take Test Screenshot
    [Arguments]    ${name}
    Take Screenshot    filename=${CURDIR}/../results/${name}.png
