/**
 * Label dictionary. English only.
 *
 * No i18n library. One flat, typed dictionary. If a string is missing,
 * ADD a key here — never hardcode a user-facing string in a feature file.
 *
 * This was briefly bilingual (Tamil + English). That was reversed on request:
 * the app is English-only. The `Label` object shape is kept rather than using
 * bare strings, so the whole dictionary stays one obvious place to edit and a
 * second language can be reintroduced without touching 36 call sites.
 */

export type Lang = 'en'

export interface Label {
  en: string
}

export const labels = {
  // ---------------------------------------------------------------
  // App / navigation
  // ---------------------------------------------------------------
  appName: { en: 'Finance Tracker' },
  dashboard: { en: 'Dashboard' },
  collections: { en: 'Collections' },
  myCollections: { en: 'My Collections' },
  customers: { en: 'Customers' },
  myCustomers: { en: 'My Customers' },
  attendance: { en: 'Attendance' },
  myAttendance: { en: 'My Attendance' },
  expenses: { en: 'Expenses' },
  myExpenses: { en: 'My Expenses' },
  reconciliation: { en: 'Reconciliation' },
  cashReconciliation: { en: 'Cash Reconciliation' },
  employees: { en: 'Employees' },
  reports: { en: 'Reports' },
  settings: { en: 'Settings' },
  profile: { en: 'Profile' },
  notifications: { en: 'Notifications' },
  more: { en: 'More' },
  history: { en: 'History' },
  admin: { en: 'Admin' },

  // ---------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------
  roleAdmin: { en: 'Admin' },
  roleCollectionAgent: { en: 'Collection Agent' },
  roleStaff: { en: 'Staff' },
  agent: { en: 'Agent' },
  allAgents: { en: 'All Agents' },
  allEmployees: { en: 'All Employees' },
  allRoles: { en: 'All Roles' },
  allStatus: { en: 'All Status' },

  // ---------------------------------------------------------------
  // Statuses — collection
  // ---------------------------------------------------------------
  statusPending: { en: 'Pending' },
  statusConfirmed: { en: 'Confirmed' },
  statusRejected: { en: 'Rejected' },
  statusCancelled: { en: 'Cancelled' },

  // Statuses — due
  statusOpen: { en: 'Open' },
  statusPartiallyPaid: { en: 'Partially Paid' },
  statusPaid: { en: 'Paid' },
  statusOverdue: { en: 'Overdue' },

  // Statuses — reconciliation
  statusSubmitted: { en: 'Submitted' },
  statusVerified: { en: 'Verified' },

  // Statuses — expense
  statusApproved: { en: 'Approved' },

  // Statuses — attendance
  statusPresent: { en: 'Present' },
  statusAbsent: { en: 'Absent' },
  statusLate: { en: 'Late' },
  statusHalfDay: { en: 'Half Day' },
  statusLeave: { en: 'Leave' },
  statusWeekOff: { en: 'Week Off' },

  // Statuses — generic
  statusActive: { en: 'Active' },
  statusInactive: { en: 'Inactive' },
  statusDraft: { en: 'Draft' },
  status: { en: 'Status' },

  // ---------------------------------------------------------------
  // Payment modes
  // ---------------------------------------------------------------
  paymentMode: { en: 'Payment Mode' },
  modeCash: { en: 'Cash' },
  modeUpi: { en: 'UPI' },
  modeBankTransfer: { en: 'Bank Transfer' },
  modeCheque: { en: 'Cheque' },
  modeOther: { en: 'Other' },
  paymentModeBreakdown: { en: 'Payment Mode Breakdown' },

  // ---------------------------------------------------------------
  // Ledger entry types
  // ---------------------------------------------------------------
  entryCredit: { en: 'Credit' },
  entryDebit: { en: 'Debit' },
  entryReconciliation: { en: 'Reconciliation' },
  entryReversal: { en: 'Reversal' },

  // ---------------------------------------------------------------
  // Notification types
  // ---------------------------------------------------------------
  notifPendingCustomer: { en: 'Pending Customer' },
  notifMissedAttendance: { en: 'Missed Attendance' },
  notifCashHandover: { en: 'Cash Handover' },
  notifReconciliationDiff: { en: 'Reconciliation Difference' },
  notifTargetAlert: { en: 'Target Alert' },
  notifGeneral: { en: 'General' },

  // ---------------------------------------------------------------
  // Form fields
  // ---------------------------------------------------------------
  customer: { en: 'Customer' },
  customerCode: { en: 'Customer Code' },
  customerName: { en: 'Customer Name' },
  employee: { en: 'Employee' },
  employeeCode: { en: 'Employee Code' },
  amount: { en: 'Amount' },
  due: { en: 'Due' },
  dueOptional: { en: 'Due (optional)' },
  dueDate: { en: 'Due Date' },
  reference: { en: 'Reference' },
  paymentReference: { en: 'Payment Reference' },
  invoiceNumber: { en: 'Invoice Number' },
  notes: { en: 'Notes' },
  reason: { en: 'Reason' },
  rejectionReason: { en: 'Rejection Reason' },
  date: { en: 'Date' },
  time: { en: 'Time' },
  from: { en: 'From' },
  to: { en: 'To' },
  name: { en: 'Name' },
  phone: { en: 'Phone' },
  email: { en: 'Email' },
  address: { en: 'Address' },
  area: { en: 'Area' },
  city: { en: 'City' },
  branch: { en: 'Branch' },
  department: { en: 'Department' },
  designation: { en: 'Designation' },
  role: { en: 'Role' },
  joiningDate: { en: 'Joining Date' },
  assignedAgent: { en: 'Assigned Agent' },
  category: { en: 'Category' },
  expenseCategory: { en: 'Expense Category' },
  description: { en: 'Description' },
  password: { en: 'Password' },
  openingBalance: { en: 'Opening Balance' },
  checkInTime: { en: 'Check-in time' },
  checkOutTime: { en: 'Check-out time' },
  totalHours: { en: 'Total Hours' },
  optional: { en: 'Optional' },
  none: { en: 'None' },
  noneGeneralPayment: { en: 'None (general payment)' },

  // ---------------------------------------------------------------
  // Placeholders
  // ---------------------------------------------------------------
  selectCustomer: { en: 'Select customer' },
  selectCategory: { en: 'Select category' },
  selectAgent: { en: 'Select agent' },
  searchCustomers: { en: 'Search name, code, phone' },
  searchEmployees: { en: 'Search name, email, code' },
  referenceHint: { en: 'UPI ref / cheque no / transaction ID' },
  autoGeneratedIfBlank: { en: 'Auto-generated if blank' },
  expensePurposeHint: { en: 'What was this expense for?' },
  rejectReasonHint: { en: 'e.g. amount mismatch, wrong customer' },
  enterReason: { en: 'Enter reason' },
  handoverAmountHint: { en: 'Amount handing over now' },
  handingOverNow: { en: 'Handing over now' },

  // ---------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------
  save: { en: 'Save' },
  cancel: { en: 'Cancel' },
  submit: { en: 'Submit' },
  confirm: { en: 'Confirm' },
  reject: { en: 'Reject' },
  approve: { en: 'Approve' },
  verify: { en: 'Verify' },
  add: { en: 'Add' },
  edit: { en: 'Edit' },
  update: { en: 'Update' },
  remove: { en: 'Remove' },
  deleteAction: { en: 'Delete' },
  deactivate: { en: 'Deactivate' },
  activate: { en: 'Activate' },
  exportAction: { en: 'Export' },
  download: { en: 'Download' },
  retry: { en: 'Retry' },
  tryAgain: { en: 'Try again' },
  refresh: { en: 'Refresh' },
  search: { en: 'Search' },
  filter: { en: 'Filter' },
  clear: { en: 'Clear' },
  close: { en: 'Close' },
  back: { en: 'Back' },
  next: { en: 'Next' },
  prev: { en: 'Prev' },
  viewAll: { en: 'View all' },
  viewDetails: { en: 'View details' },
  checkIn: { en: 'Check In' },
  checkOut: { en: 'Check Out' },
  login: { en: 'Login' },
  logout: { en: 'Logout' },
  recordCollection: { en: 'Record Collection' },
  addCustomer: { en: 'Add Customer' },
  addEmployee: { en: 'Add Employee' },
  addExpense: { en: 'Add Expense' },
  addDue: { en: 'Add Due' },
  submitCashHandover: { en: 'Submit Cash Handover' },
  correctAttendance: { en: 'Correct Attendance' },
  rejectCollection: { en: 'Reject Collection' },
  rejectExpense: { en: 'Reject Expense' },
  rejectReconciliation: { en: 'Reject Reconciliation' },
  exportCsv: { en: 'Export CSV' },

  // ---------------------------------------------------------------
  // KPI / money labels
  // ---------------------------------------------------------------
  todaysCollection: { en: "Today's Collection" },
  todaysTotal: { en: 'Collected today' },
  monthCollection: { en: 'This Month' },
  collected: { en: 'Collected' },
  pending: { en: 'Pending' },
  pendingReviews: { en: 'Pending Reviews' },
  pendingHandover: { en: 'Pending Handover' },
  outstanding: { en: 'Outstanding' },
  totalOutstanding: { en: 'Total Outstanding' },
  outstandingAging: { en: 'Outstanding Aging' },
  cashInHand: { en: 'Cash in Hand' },
  cashCollected: { en: 'Cash Collected' },
  confirmedCash: { en: 'Confirmed Cash' },
  cashToHandOver: { en: 'Cash to hand over' },
  submittedAmount: { en: 'Submitted Amount' },
  difference: { en: 'Difference' },
  shortfall: { en: 'Shortfall' },
  excess: { en: 'Excess' },
  balance: { en: 'Balance' },
  total: { en: 'Total' },
  count: { en: 'Count' },
  target: { en: 'Target' },
  activeAgents: { en: 'Active Agents' },
  attendanceToday: { en: 'Attendance Today' },
  recentActivity: { en: 'Recent Activity' },
  last30Days: { en: 'Last 30 Days' },
  currentMonth: { en: 'Current Month' },
  allOpenDues: { en: 'All open dues' },
  awaitingConfirmation: { en: 'Awaiting approval' },
  presentOfTotalStaff: { en: 'Present / Total staff' },

  // ---------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------
  loading: { en: 'Loading…' },
  saving: { en: 'Saving…' },
  recording: { en: 'Recording…' },
  submitting: { en: 'Submitting…' },
  noDataYet: { en: 'No data yet' },
  noRecords: { en: 'No records' },
  noCollectionsYet: { en: 'No collections yet' },
  noCustomersFound: { en: 'No customers found' },
  noEmployeesFound: { en: 'No employees found' },
  noExpensesYet: { en: 'No expenses yet' },
  noAttendanceRecords: { en: 'No attendance records' },
  noReconciliationsYet: { en: 'No reconciliations yet' },
  noRecentActivity: { en: 'No recent activity' },
  somethingWentWrong: { en: 'Something went wrong' },
  noInternet: { en: 'No internet' },
  networkError: { en: 'Network error' },
  saved: { en: 'Saved' },
  deleted: { en: 'Deleted' },
  requiredField: { en: 'Required field' },
  allFieldsRequired: { en: 'All fields are required' },
  amountMustBePositive: { en: 'Amount must be greater than 0' },
  enterValidAmount: { en: 'Enter a valid amount' },
  reasonRequired: { en: 'Reason required' },
  alreadySubmitted: { en: 'Already Submitted' },
  collectionRecorded: { en: 'Collection recorded' },
  collectionConfirmed: { en: 'Collection confirmed' },
  collectionRejected: { en: 'Collection rejected' },
  expenseSubmitted: { en: 'Expense submitted' },
  expenseDeleted: { en: 'Expense deleted' },
  reconciliationSubmitted: { en: 'Reconciliation submitted' },
  reconciliationRejected: { en: 'Reconciliation rejected' },
  reconciliationVerified: { en: 'Reconciliation verified' },
  checkedIn: { en: 'Checked in' },
  checkedOut: { en: 'Checked out' },
  downloadFailed: { en: 'Download failed' },
  settingsSaved: { en: 'Settings saved' },
  profileUpdated: { en: 'Profile updated' },
  passwordChanged: { en: 'Password changed' },
  offlineWillSync: { en: 'Will send when back online' },

  // ===============================================================
  // ADMIN SCREENS — appended by the admin-screens agent.
  // Append-only block. Do not reorder. Other agents append below.
  // ===============================================================

  // Generic table / filter chrome
  applyFilters: { en: 'Apply Filters' },
  filters: { en: 'Filters' },
  actions: { en: 'Actions' },
  refNo: { en: 'No.' },
  page: { en: 'Page' },
  sortByOutstanding: { en: 'Sort by outstanding' },
  highestFirst: { en: 'Highest first' },
  lowestFirst: { en: 'Lowest first' },

  // Shared approve / reject pattern
  confirmThisAmount: { en: 'Confirm this amount?' },
  approveThisAmount: { en: 'Approve this amount?' },
  verifyThisAmount: { en: 'Verify this amount?' },
  moneyMovesWarning: { en: 'Confirming moves real money. It cannot be undone.' },
  reasonVisibleToAgent: { en: 'The agent will see this reason' },
  pendingQueue: { en: 'Pending Queue' },
  pendingValue: { en: 'Pending Value' },
  pendingCount: { en: 'Pending Count' },
  confirmedToday: { en: 'Confirmed Today' },
  allRecords: { en: 'All Records' },

  // Collections (admin)
  confirmCollection: { en: 'Confirm Collection' },
  collectedAt: { en: 'Collected At' },
  noCollectionsFound: { en: 'No collections found' },

  // Reconciliation (admin)
  verifyReconciliation: { en: 'Verify Reconciliation' },
  toVerify: { en: 'To Verify' },
  matched: { en: 'Matched' },
  totalShortfall: { en: 'Total Shortfall' },

  // Attendance (admin)
  saveCorrection: { en: 'Save Correction' },
  corrected: { en: 'Corrected' },
  attendanceCorrected: { en: 'Attendance corrected' },
  hours: { en: 'Hours' },
  gpsLocation: { en: 'GPS' },
  presentToday: { en: 'Present' },
  absentToday: { en: 'Absent' },

  // Expenses (admin)
  approveExpense: { en: 'Approve Expense' },
  pendingApprovals: { en: 'Pending Approvals' },
  approvedTotal: { en: 'Approved Total' },
  expenseApproved: { en: 'Expense approved' },
  expenseRejected: { en: 'Expense rejected' },

  // Employees (admin)
  editEmployee: { en: 'Edit Employee' },
  deactivateEmployee: { en: 'Deactivate employee?' },
  deactivateEmployeeWarning: { en: 'They cannot log in until reactivated.' },
  newPasswordBlankToKeep: { en: 'New password (leave blank to keep)' },
  saveChanges: { en: 'Save Changes' },
  nameAndEmailRequired: { en: 'Name and email are required' },
  passwordMinLength: { en: 'Password must be at least 8 characters' },
  nameRequired: { en: 'Name is required' },
  employeeSaved: { en: 'Employee saved' },

  // Customers (admin)
  editCustomer: { en: 'Edit Customer' },
  deactivateCustomer: { en: 'Deactivate customer?' },
  deactivateCustomerWarning: { en: 'No new collection can be recorded for them until reactivated.' },
  customerSaved: { en: 'Customer saved' },
  state: { en: 'State' },
  pincode: { en: 'Pincode' },

  // Reports (admin)
  exportDataForRange: { en: 'Export data as CSV for the selected date range' },
  agentOrEmployee: { en: 'Agent / Employee' },
  generating: { en: 'Generating…' },
  reportDownloaded: { en: 'Report downloaded' },
  reportFailed: { en: 'Could not generate report' },
  collectionsReport: { en: 'Collections Report' },
  collectionsReportDesc: { en: 'Agent, customer, amount, mode, status' },
  attendanceReport: { en: 'Attendance Report' },
  attendanceReportDesc: { en: 'Daily attendance for all employees with hours and status' },
  expensesReport: { en: 'Expenses Report' },
  expensesReportDesc: { en: 'Category, amount, approval status' },
  reconciliationReport: { en: 'Reconciliation Report' },
  reconciliationReportDesc: { en: 'Agent cash reconciliation history with differences' },
  duesReport: { en: 'Outstanding Dues' },
  duesReportDesc: { en: 'All open dues per customer with outstanding amounts' },

  // Settings / branches (admin)
  company: { en: 'Company' },
  branches: { en: 'Branches' },
  allBranches: { en: 'All Branches' },
  addBranch: { en: 'Add Branch' },
  newBranch: { en: 'New Branch' },
  branchName: { en: 'Branch Name' },
  branchCode: { en: 'Branch Code' },
  noBranchesYet: { en: 'No branches yet' },
  branchCreated: { en: 'Branch created' },
  branchUpdated: { en: 'Branch updated' },
  companySettings: { en: 'Company Settings' },
  companyName: { en: 'Company Name' },
  currencyCode: { en: 'Currency Code' },
  currencySymbol: { en: 'Currency Symbol' },
  timezone: { en: 'Timezone' },
  financialYearStart: { en: 'Financial year start (month 1-12)' },
  manageCompanyAndBranches: { en: 'Manage company configuration and branches' },

  // ---------------------------------------------------------------
  // MONEY SCREENS (collections + reconciliation) — appended block.
  // Owned by the collections/reconciliation agent. Append only.
  // ---------------------------------------------------------------
  gpsOnSubmit: { en: 'Location is saved on submit' },
  gpsAcquiring: { en: 'Getting location…' },
  gpsCaptured: { en: 'Location captured' },
  gpsUnavailable: { en: 'Location unavailable' },
  gpsSkippedNote: { en: 'Location off — you can still check in' },
  offlineCollectionsNote: { en: 'Collections are saved here and sent when signal returns' },
  queued: { en: 'Not sent yet' },
  loadingDues: { en: 'Loading dues…' },
  duesLoadFailed: { en: 'Could not load dues' },
  noOpenDues: { en: 'No open dues' },
  receiptNumber: { en: 'Receipt No' },
  collectionCancelled: { en: 'Collection cancelled' },
  customerRequired: { en: 'Select a customer' },
  handOverEverything: { en: 'Hand over everything' },
  amountsMatch: { en: 'Amounts match' },
  nothingToHandOver: { en: 'Nothing left to hand over' },
  handoverNeedsInternet: { en: 'Cash handover needs internet' },
  handoverNeedsInternetHint: { en: 'Try again when you have signal' },
  // ---------------------------------------------------------------
  // Attendance / Expenses / Customers screens
  // (appended block — attendance+expenses+customers agent)
  // ---------------------------------------------------------------
  todaysStatus: { en: "Today's Status" },
  startWork: { en: 'Check In' },
  endWork: { en: 'Check Out' },
  workDone: { en: 'Day complete' },
  hoursWorked: { en: 'Hours worked' },
  noSignalTryAgain: { en: 'No signal — try again' },
  rejectedTotal: { en: 'Rejected' },
  deleteExpense: { en: 'Delete expense' },
  deleteExpenseConfirm: { en: 'Delete this expense? This cannot be undone.' },
  onlyPendingCanBeDeleted: { en: 'Only a pending expense can be deleted' },
  notesOptional: { en: 'Notes (optional)' },
  assignedCustomers: { en: 'Assigned customers' },
  noCustomersAssigned: { en: 'No customers assigned yet' },
  callCustomer: { en: 'Call' },
  noPhoneNumber: { en: 'No phone number' },
  dues: { en: 'Dues' },
  totalDues: { en: 'Total Dues' },
  paidAmount: { en: 'Paid' },
  noDues: { en: 'No dues' },
  collectionHistory: { en: 'Collection History' },
  collectionNumber: { en: 'Collection No.' },

  // ===============================================================
  // SHELL / DASHBOARD / AUTH / PROFILE / OFFLINE — appended block.
  // Owned by the navigation-shell agent. Append only, do not reorder.
  // ===============================================================

  // --- shell ---
  menu: { en: 'Menu' },
  openMenu: { en: 'Open menu' },
  mainMenu: { en: 'Main menu' },
  offlineNow: { en: 'Offline' },
  waitingToSync: { en: 'waiting' },
  pendingSync: { en: 'Waiting to sync' },
  logoutQuestion: { en: 'Sign out?' },
  logoutWarning: { en: 'Unsaved work will be lost. You need your password to sign in again.',
  },

  // --- auth ---
  signIn: { en: 'Sign in' },
  signingIn: { en: 'Signing in…' },
  signInSubtitle: { en: 'Sign in to your account' },
  invalidCredentials: { en: 'Wrong email or password',
  },
  loginFailed: { en: 'Could not sign in' },
  accountInactive: { en: 'Your account is switched off. Contact your administrator.',
  },
  emailRequired: { en: 'Email is required' },
  passwordRequired: { en: 'Password is required' },
  showPassword: { en: 'Show password' },
  hidePassword: { en: 'Hide password' },
  forgotPassword: { en: 'Forgot password?' },
  forgotPasswordHelp: { en: 'Contact your administrator. They will set a new password for you.',
  },
  backToLogin: { en: 'Back to sign in' },

  // --- password ---
  changePassword: { en: 'Change password' },
  currentPassword: { en: 'Current password' },
  newPassword: { en: 'New password' },
  confirmPassword: { en: 'Confirm new password' },
  passwordsDoNotMatch: { en: 'The two passwords are not the same',
  },
  passwordTooShort: { en: 'Password must be at least 8 characters',
  },
  passwordUpdateFailed: { en: 'Could not change the password',
  },

  // --- profile ---
  personalInformation: { en: 'Personal information' },
  editProfile: { en: 'Edit profile' },
  fullName: { en: 'Full name' },
  lastLogin: { en: 'Last login' },
  unassigned: { en: 'Unassigned' },
  appearance: { en: 'Appearance' },
  darkMode: { en: 'Dark mode' },
  lightMode: { en: 'Light mode' },
  useDarkScreen: { en: 'Use the dark screen' },

  // --- dashboard ---
  welcome: { en: 'Welcome' },
  notCheckedIn: { en: 'Not checked in' },
  pendingCollections: { en: 'Pending collections' },
  collectionPercent: { en: 'Collection %' },
  collectionTrend: { en: 'Collection trend' },
  agingCurrent: { en: 'Not yet due' },
  aging1to30: { en: 'Overdue 1–30 days' },
  aging31to60: { en: 'Overdue 31–60 days' },
  aging60plus: { en: 'Overdue 60+ days' },
  bucket: { en: 'Bucket' },
  who: { en: 'Who' },
  whatHappened: { en: 'What happened' },
  when: { en: 'When' },
  system: { en: 'System' },

  // --- notifications ---
  noNotifications: { en: 'No alerts right now' },
  refreshing: { en: 'Refreshing…' },
  dismiss: { en: 'Dismiss' },

  // --- offline page ---
  offlineTitle: { en: 'You are offline' },
  offlineHelp: { en: 'Saved collections are safe. They sync automatically when the network returns.',
  },
  backToDashboard: { en: 'Back to dashboard' },

  // ===============================================================
  // SHELL / DASHBOARD / AUTH / PROFILE — second appended block.
  // Owned by the navigation-shell agent. Append only, do not reorder.
  // ===============================================================

  // --- nav destinations (full names, used by the sidebar and More sheet) ---
  loans: { en: 'Loans' },
  loanRequests: { en: 'Loan Requests' },
  collectionApproval: { en: 'Collection Approval' },
  cashSettlement: { en: 'Cash Settlement' },
  officeExpenses: { en: 'Office Expenses' },

  // --- short tab labels (must fit ~72px at 360px) ---
  tabHome: { en: 'Home' },
  tabCollections: { en: 'Collections' },
  tabCustomers: { en: 'Customers' },
  tabLoans: { en: 'Loans' },
  tabAttendance: { en: 'Attendance' },
  tabExpenses: { en: 'Expenses' },
  tabRequests: { en: 'Requests' },
  tabSettlement: { en: 'Settlement' },
  tabMore: { en: 'More' },

  // --- shell status ---
  online: { en: 'Online' },
  syncedUpToDate: { en: 'Everything is saved' },
  offlineBannerHelp: { en: 'Work is saved on this phone and sent when the network returns.' },
  screenTitle: { en: 'Screen' },
  moreOptions: { en: 'More options' },
  yourAccount: { en: 'Your account' },
  stayLoggedIn: { en: 'Stay signed in' },

  // --- dashboard ---
  loanOutstanding: { en: 'Loan Outstanding' },
  activeLoans: { en: 'Active loans' },
  dueToday: { en: 'Due today' },
  collectedToday: { en: 'Collected today' },
  awaitingApproval: { en: 'Awaiting approval' },
  openDues: { en: 'Open dues' },
  handOverCash: { en: 'Hand over cash' },
  quickActions: { en: 'Quick actions' },
  attendanceTodayLabel: { en: 'Attendance today' },
  ofExpected: { en: 'of expected' },
  allOpenDuesCaption: { en: 'All open dues' },
  agentsOnDuty: { en: 'Agents on duty' },
  period: { en: 'Period' },
  periodDaily: { en: 'Daily' },
  periodMonthly: { en: 'Monthly' },
  periodYearly: { en: 'Yearly' },
  agentAttendanceToday: { en: "Today's agent attendance" },
  dashboardLoadFailed: { en: 'Could not load the dashboard' },
  location: { en: 'Location' },
  viewOnMap: { en: 'View on map' },
  locationBlockedHelp: { en: 'Location access is blocked. Follow these steps to turn it on:' },
  gotIt: { en: 'Got it' },

  // --- profile / appearance ---
  useDarkScreenHint: { en: 'Easier on the eyes indoors and at night.' },
  accountDetails: { en: 'Account details' },
  savingChanges: { en: 'Saving…' },
  couldNotSave: { en: 'Could not save your changes' },

  // --- short KPI tile labels (a tile label truncates past ~16 characters) ---
  toApprove: { en: 'To approve' },
  cashOnHand: { en: 'Cash on hand' },

  // ===============================================================
  // MONEY SCREENS (collections + cash handover) — appended block.
  // Owned by the money-screens agent. Append only, do not reorder.
  // ===============================================================

  // --- collections ---
  loanPayment: { en: 'Loan' },
  records: { en: 'records' },
  amountExceedsOutstanding: { en: 'More than the outstanding balance' },
  noOutstandingBalance: { en: 'No outstanding balance' },
  collectionQueuedOffline: { en: 'Saved on this phone. It sends when the signal returns.' },
  gpsDeniedStillSaves: { en: 'Location off — the collection is still saved' },
  cancelCollection: { en: 'Cancel collection' },
  paymentModeRequired: { en: 'Choose a payment mode' },
  filterByDate: { en: 'Filter by date' },
  noCollectionsForDate: { en: 'No collections on this date' },
  recordFirstCollection: { en: 'Tap Record Collection to add the first one' },

  // --- cash handover ---
  cashHandover: { en: 'Cash handover' },
  handoverAll: { en: 'Hand over everything' },
  handoverShortfall: { en: 'Short by' },
  handoverExcess: { en: 'Over by' },
  handoverSubmitting: { en: 'Handing over…' },
  handoverAmount: { en: 'Cash you are handing over' },
  autoFromConfirmedCash: { en: 'Added up from your confirmed cash collections' },
  handoverNotQueued: { en: 'Cash handover is never saved for later. It needs a live confirmation.' },

  // ===============================================================
  // ATTENDANCE / EXPENSES / CUSTOMERS — appended by the
  // attendance+expenses+customers agent. Append only, do not reorder.
  // ===============================================================

  // --- attendance ---
  attendanceNeedsInternet: { en: 'Check in and check out need internet' },
  gpsSavedOnCheckIn: { en: 'Location is saved when you check in' },
  notCheckedInYet: { en: 'Not checked in yet' },
  checkInFailed: { en: 'Could not check in' },
  checkOutFailed: { en: 'Could not check out' },
  dayAlreadyDone: { en: 'Work day finished' },
  noAttendanceHelp: { en: 'Check in when you start work. Your days show here.' },

  // --- expenses ---
  expensesNeedInternet: { en: 'Expenses need internet. Try again when you have signal.' },
  categoryRequired: { en: 'Choose a category' },
  noExpensesHelp: { en: 'Add bus fare, tea or fuel as you spend it.' },
  withdrawExpense: { en: 'Withdraw this claim?' },
  withdrawExpenseBody: { en: 'The claim is marked Rejected and stays in the records. You cannot bring it back. Only a pending claim can be withdrawn.' },
  withdraw: { en: 'Withdraw' },
  keepIt: { en: 'Keep it' },
  expenseWithdrawn: { en: 'Claim withdrawn' },
  thisMonth: { en: 'This month' },

  // --- customer list ---
  requestedDate: { en: 'Requested Date' },
  disbursementDate: { en: 'Disbursement Date' },
  requestedOn: { en: 'Requested' },
  disburseOn: { en: 'Disburse' },
  loanAmount: { en: 'Loan Amount' },
  loanRequestsCount: { en: 'loan requests' },
  results: { en: 'Results' },
  noLoanRequestsYet: { en: 'No loan requests yet' },
  noResultsForFilter: { en: 'Nothing matches this filter' },
  newCustomerNotCreated: { en: 'New customer — not created yet' },
  highestOutstandingFirst: { en: 'Highest outstanding first' },

  // --- customer detail ---
  activityTimeline: { en: 'Activity Timeline' },
  dueCreated: { en: 'Due created' },
  collectionEntry: { en: 'Collection' },
  loanNumber: { en: 'Loan No.' },
  dailyInstallment: { en: 'Daily' },
  disbursedOn: { en: 'Disbursed' },
  noLoans: { en: 'No loans' },
  noActivityYet: { en: 'No activity yet' },
  penaltyRate: { en: 'Penalty Rate' },
  penaltyRatePerMonth: { en: 'Penalty rate (% per month)' },
  gpsCoordinates: { en: 'GPS' },

  // --- due dialogs ---
  editDue: { en: 'Edit Due' },
  dueAdded: { en: 'Due added' },
  dueUpdated: { en: 'Due updated' },

  // ===============================================================
  // ADMIN SCREENS (collections / customers / employees / attendance /
  // reconciliation / expenses / reports / settings) — appended by the
  // admin-screens agent. Append only, do not reorder.
  // ===============================================================

  // --- shared approve / reject ---
  noPendingItems: { en: 'Nothing waiting for approval' },
  queueAllClear: { en: 'Every record has been actioned' },
  actionFailed: { en: 'Could not save. Nothing changed.' },

  // --- customers ---
  activeLoan: { en: 'Active Loan' },
  adjustOpeningBalance: { en: 'Adjust Opening Balance' },
  amountToDeduct: { en: 'Amount to deduct' },
  balanceAdjusted: { en: 'Opening balance adjusted' },
  balanceReasonHint: { en: 'e.g. data correction, migrated balance' },
  openingBalanceHint: { en: 'Debt before any collection. It cannot be changed after creation.' },

  // --- attendance ---
  gpsAccuracy: { en: 'Accuracy' },

  // --- reports ---
  reportFilters: { en: 'Report Filters' },

  // --- branches / settings ---
  editBranch: { en: 'Edit Branch' },
  officeLocation: { en: 'Office Location (GPS)' },
  latitude: { en: 'Latitude' },
  longitude: { en: 'Longitude' },
  useMyCurrentLocation: { en: 'Use my current location' },
  officeGpsSet: { en: 'Office GPS set' },
  geolocationUnsupported: { en: 'This device cannot give a location' },
  locationCaptured: { en: 'Location captured' },
  previewOnMap: { en: 'Preview office on map' },

  // ===============================================================
  // LOANS MODULE (agent loans, admin loans, loan requests, monitoring,
  // collection approval, loan detail) — appended by the loans agent.
  // Append only, do not reorder.
  // ===============================================================

  // --- shared loan nouns ---
  myLoans: { en: 'My loans' },
  disbursedAmount: { en: 'Disbursed' },
  todaysInstallment: { en: "Today's installment" },
  principalOutstanding: { en: 'Principal outstanding' },
  penaltyOutstanding: { en: 'Penalty outstanding' },
  principalCollected: { en: 'Principal collected' },
  interestPercent: { en: 'Interest %' },
  interest: { en: 'Interest' },
  tenureDays: { en: 'Tenure (days)' },
  tenure: { en: 'Tenure' },
  penaltyAmount: { en: 'Penalty amount' },
  penaltyPerMiss: { en: 'Penalty per missed day' },
  repaymentStartDate: { en: 'Repayment start date' },
  perDay: { en: 'per day' },
  daysUnit: { en: 'days' },
  totalLoans: { en: 'Total loans' },
  totalLoanAmount: { en: 'Total loan amount' },
  overdueLoans: { en: 'Overdue' },
  missed: { en: 'Missed' },
  expectedToday: { en: 'Expected today' },
  dueAmount: { en: 'Due amount' },
  paidAt: { en: 'Paid at' },
  paymentNumber: { en: 'Payment #' },
  scheduleDate: { en: 'Schedule date' },
  collectedAtLabel: { en: 'Collected at' },
  requestNumber: { en: 'Request #' },
  requestedBy: { en: 'Requested by' },

  // --- agent loans screen ---
  todaysCollectionsHeading: { en: "Today's collections" },
  allMyLoans: { en: 'All my loans' },
  noPendingCollectionsToday: { en: 'Nothing left to collect today' },
  noLoansAssigned: { en: 'No loans assigned to you yet' },
  collect: { en: 'Collect' },
  collectInstallment: { en: 'Collect installment' },
  confirmCollectionAmount: { en: 'Confirm this collection' },
  needsAdminApproval: { en: 'Needs admin approval' },
  balanceUpdatesAfterApproval: {
    en: 'The loan balance changes only after an admin approves this payment.',
  },
  awaitingApprovalRow: { en: 'Sent for approval — balance not updated yet' },
  collectionSentForApproval: { en: 'Collection sent for admin approval' },
  collectionFailed: { en: 'Could not record the collection' },
  requestLoan: { en: 'Request loan' },
  myLoanRequests: { en: 'My loan requests' },
  existingCustomer: { en: 'Existing customer' },
  newCustomerOption: { en: 'New customer' },
  newCustomerName: { en: 'New customer name' },
  loanRequestSubmitted: { en: 'Loan request sent for admin approval' },
  loanAmountTenureDateRequired: {
    en: 'Loan amount, tenure and disbursement date are required',
  },
  tenureMustBePositive: { en: 'Tenure must be more than 0 days' },
  newCustomerNameRequired: { en: 'Enter the new customer name' },

  // --- admin loans list ---
  createLoan: { en: 'Create loan' },
  loanCreated: { en: 'Loan created' },
  searchLoans: { en: 'Search customer or loan number' },
  noLoansFound: { en: 'No loans found' },
  allStatuses: { en: 'All statuses' },

  // --- admin approve / reject (identical on three screens) ---
  approvePayment: { en: 'Approve payment' },
  rejectPayment: { en: 'Reject payment' },
  approvePaymentHelp: {
    en: 'This marks the installment paid and updates the loan balance.',
  },
  rejectPaymentHelp: {
    en: 'The installment stays open so the agent can collect again.',
  },
  approveLoanRequest: { en: 'Approve loan request' },
  rejectLoanRequest: { en: 'Reject loan request' },
  approveLoanRequestHelp: {
    en: 'The loan is created and assigned to the agent who asked for it.',
  },
  rejectLoanRequestHelp: { en: 'Say why the request is refused.' },
  paymentApproved: { en: 'Payment approved' },
  paymentRejected: { en: 'Payment rejected — the agent can collect again' },
  loanRequestApproved: { en: 'Loan request approved and loan created' },
  loanRequestRejected: { en: 'Loan request rejected' },
  approvalFailed: { en: 'Could not approve. Nothing changed.' },
  rejectionFailed: { en: 'Could not reject. Nothing changed.' },
  reviewAgentLoanRequests: { en: 'Review loan requests sent by agents' },
  rejectedReasonPrefix: { en: 'Rejected' },

  // --- admin loan monitoring ---
  loanMonitoring: { en: 'Loan monitoring' },
  collectionStatusForDay: { en: 'Collection status for the day' },
  noSchedulesForDate: { en: 'No installments for this date' },
  totalScheduled: { en: 'Total scheduled' },
  paymentsReceived: { en: 'Payments received' },
  stillToCollect: { en: 'Still to collect' },
  notCollected: { en: 'Not collected' },
  filterAll: { en: 'All' },

  // --- admin loan detail ---
  scheduleTab: { en: 'Schedule' },
  paymentsTab: { en: 'Payments' },
  penaltiesTab: { en: 'Penalties' },
  detailsTab: { en: 'Details' },
  noScheduleEntries: { en: 'No installments yet' },
  noPaymentsRecorded: { en: 'No payments recorded' },
  noPenalties: { en: 'No penalties' },
  collectCash: { en: 'Collect cash' },
  collectCashTitle: { en: 'Collect a cash payment' },
  remainingPrincipal: { en: 'Remaining principal' },
  cashCollectionRecorded: { en: 'Cash collection recorded' },
  reverse: { en: 'Reverse' },
  reversePayment: { en: 'Reverse payment' },
  confirmReversal: { en: 'Confirm reversal' },
  reversalReasonHint: { en: 'Say why this payment is being reversed' },
  paymentReversed: { en: 'Payment reversed' },
  reversalFailed: { en: 'Could not reverse the payment' },
  reversed: { en: 'Reversed' },
  waive: { en: 'Waive' },
  waivePenalty: { en: 'Waive penalty' },
  waivedAmount: { en: 'Waived amount' },
  waived: { en: 'Waived' },
  confirmWaiver: { en: 'Confirm waiver' },
  penaltyWaived: { en: 'Penalty waived' },
  waiverFailed: { en: 'Could not waive the penalty' },
  reassignAgent: { en: 'Reassign agent' },
  confirmReassignment: { en: 'Confirm reassignment' },
  agentReassigned: { en: 'Agent reassigned' },
  reassignFailed: { en: 'Could not reassign the agent' },
  loanCreateFailed: { en: 'Could not create the loan' },
  loanRequestFailed: { en: 'Could not send the loan request' },
  customerProfile: { en: 'Customer profile' },
  noHistoryForCustomer: { en: 'No history for this customer' },
  unpaidDues: { en: 'Unpaid dues' },
  recentCollections: { en: 'Recent collections' },
  customerLoadFailed: { en: 'Could not load the customer' },
  viewCustomer: { en: 'View customer' },
} as const satisfies Record<string, Label>

export type LabelKey = keyof typeof labels

export function t(k: LabelKey): Label {
  return labels[k]
}

/** Every status enum string in the database, mapped to its label key. */
const STATUS_LABEL_KEYS: Record<string, LabelKey> = {
  // collection_status
  PENDING: 'statusPending',
  CONFIRMED: 'statusConfirmed',
  REJECTED: 'statusRejected',
  CANCELLED: 'statusCancelled',
  // due_status
  OPEN: 'statusOpen',
  PARTIALLY_PAID: 'statusPartiallyPaid',
  PAID: 'statusPaid',
  OVERDUE: 'statusOverdue',
  // reconciliation_status
  SUBMITTED: 'statusSubmitted',
  VERIFIED: 'statusVerified',
  // expense_status
  APPROVED: 'statusApproved',
  // attendance_status
  PRESENT: 'statusPresent',
  ABSENT: 'statusAbsent',
  LATE: 'statusLate',
  HALF_DAY: 'statusHalfDay',
  LEAVE: 'statusLeave',
  WEEK_OFF: 'statusWeekOff',
  // generic
  ACTIVE: 'statusActive',
  INACTIVE: 'statusInactive',
  DRAFT: 'statusDraft',
  // payment_mode (shown in the same badge slot on some screens)
  CASH: 'modeCash',
  UPI: 'modeUpi',
  BANK_TRANSFER: 'modeBankTransfer',
  CHEQUE: 'modeCheque',
  OTHER: 'modeOther',
  // user_role
  ADMIN: 'roleAdmin',
  COLLECTION_AGENT: 'roleCollectionAgent',
  STAFF: 'roleStaff',
  // ledger_entry_type
  CREDIT: 'entryCredit',
  DEBIT: 'entryDebit',
  RECONCILIATION: 'entryReconciliation',
  REVERSAL: 'entryReversal',
  // notification_type
  PENDING_CUSTOMER: 'notifPendingCustomer',
  MISSED_ATTENDANCE: 'notifMissedAttendance',
  CASH_HANDOVER: 'notifCashHandover',
  RECONCILIATION_DIFF: 'notifReconciliationDiff',
  TARGET_ALERT: 'notifTargetAlert',
  GENERAL: 'notifGeneral',
}

/**
 * Resolve any status-like enum string to a bilingual label.
 * Unknown values fall back to the raw string in both languages.
 */
export function statusLabel(status: string): Label {
  const key = STATUS_LABEL_KEYS[status?.toUpperCase?.() ?? '']
  return key ? labels[key] : { en: status }
}

export { STATUS_LABEL_KEYS }
