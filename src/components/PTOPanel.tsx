import {
  Alert, AlertIcon,
  Box, Badge, Button, Divider, Flex, FormControl, FormLabel, Heading,
  HStack, Input, Modal, ModalBody, ModalCloseButton, ModalContent,
  ModalFooter, ModalHeader, ModalOverlay, NumberInput, NumberInputField,
  Select, SimpleGrid, Spinner, Stat, StatHelpText, StatLabel, StatNumber,
  Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue, useDisclosure,
  useToast, VStack, Textarea,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_BALANCES = '6a71804da8140c7b12b1d3c1';
const INSIGHT_REQUESTS = '6a7180504af977ffe55b40f6';
const INSIGHT_EMPLOYEE_DIRECTORY = '6a9aafbda51ebb56d30d4896';
const INSIGHT_HOLIDAY_WINDOWS = '6a9b055268b2d1b98a71d17b';

const WF_BALANCE  = '6a717f76a8140c7b12b1ce9e';
const WF_REQUEST  = '6a717f77a8140c7b12b1ceac';
const PHASE_PENDING   = '6a717fac693253992c87719e';
const PHASE_APPROVED  = '6a717faf693253992c8771e7';
const PHASE_DENIED    = '6a717fb1693253992c877206';
const PHASE_CANCELLED = '6a717fb4693253992c87722d';
const PHASE_BALANCE_ACTIVE = '6a717fa7693253992c877151';

// Employee Directory phases eligible to get a PTO Balance (excludes Archive).
const ED_PHASE_ACTIVE     = '6a4b9b64fd37515ffb36cd6b';
const ED_PHASE_CONTRACTOR = '6a4b9b64fd37515ffb36cd9e';

// PTO Balance field IDs
const BF_EMPLOYEE  = '6a717fe74af977ffe55b3dcb';
const BF_YEAR      = '6a717fe74af977ffe55b3dce';
const BF_TOTAL     = '6a717fe74af977ffe55b3dd1';
const BF_USED      = '6a717fe74af977ffe55b3dd5';
const BF_PENDING   = '6a717fe74af977ffe55b3dd9';
const BF_REMAINING = '6a717fe74af977ffe55b3ddd';
const BF_EMPLOYEE_DIRECTORY_LINK = '6a9afa4ded1791be001f08a9';
const BF_LEAVE_YEAR_START        = '6a9afa4ded1791be001f08ac';

// Monthly Accrual Qualification checkboxes — the field's "defaultValue: 1"
// only pre-fills the UI creation form; activity.create() via the API/SDK
// does NOT apply it. Without explicitly setting all 12 here, Total Days
// Allocated's function field sees every month as unqualified and computes 0.
const BF_QUALIFYING_MONTHS = [
  '6a9afa4ded1791be001f08b2', // April
  '6a9afa4ded1791be001f08b5', // May
  '6a9afa4ded1791be001f08b8', // June
  '6a9afa4ded1791be001f08bb', // July
  '6a9afa4ded1791be001f08be', // August
  '6a9afa4ded1791be001f08c1', // September
  '6a9afa4ded1791be001f08c4', // October
  '6a9afa4ded1791be001f08c7', // November
  '6a9afa4ded1791be001f08cb', // December
  '6a9afa4ded1791be001f08ce', // January
  '6a9afa4ded1791be001f08d1', // February
  '6a9afa4ded1791be001f08d4', // March
];

// PTO Request field IDs
const RF_EMPLOYEE  = '6a717fe74af977ffe55b3de5';
const RF_TYPE      = '6a717fe74af977ffe55b3de9';
const RF_START     = '6a717fe74af977ffe55b3ded';
const RF_END       = '6a717fe74af977ffe55b3df1';
const RF_DAYS      = '6a717fe74af977ffe55b3df5';
const RF_EMP_NOTE  = '6a717fe74af977ffe55b3df9';
const RF_MGR_NOTE  = '6a717fe74af977ffe55b3dfd';
// Required once a decision is made on a request — moving to Approved/Denied/Cancelled
// without it fails validation ("Error in fields... Field: [object Object]").
const RF_APPROVED_BY = '6aa7a772da23a46b38d3441c';

interface BalanceRow {
  id: string; name: string; phase: string;
  employee: string | null; year: string | null;
  totalDays: number | null; daysUsed: number | null;
  daysPending: number | null; daysRemaining: number | null;
  notes: string | null;
}

interface RequestRow {
  id: string; name: string; phase: string;
  employee: string | null; ptoType: string | null;
  startDate: number | null; endDate: number | null;
  daysRequested: number | null; employeeNotes: string | null;
  managerNotes: string | null;
}

interface EmployeeRow {
  id: string; name: string; firstname: string | null; lastname: string | null;
  supervisorId: string | null; probationEndDate: number | null; phaseId: string;
}

interface HolidayWindows {
  id: string; summerStart: string | null; summerEnd: string | null;
  winterStart: string | null; winterEnd: string | null;
  guidanceNote: string | null; medicalLeaveNote: string | null;
}

function fmtDate(val: unknown): string {
  if (!val || isNaN(Number(val))) return '—';
  const n = Number(val);
  const ms = n > 1e10 ? n : n * 1000;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

const REQUEST_COLOR: Record<string, string> = {
  'Pending': 'yellow', 'Approved': 'green', 'Denied': 'red', 'Cancelled': 'gray',
};

const PTO_TYPES = ['Vacation', 'Sick Leave', 'Personal', 'Public Holiday', 'Other'];

// Finland's holiday accrual year runs 1 April - 31 March, not the calendar
// year — matches the "Year" label PTO Balance's own function field computes
// from Leave Year Start (e.g. "2026/2027" for the year starting 1 Apr 2026).
function computeCurrentLeaveYear(): string {
  const now = new Date();
  const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${startYear}/${startYear + 1}`;
}
const currentLeaveYear = computeCurrentLeaveYear();

function defaultLeaveYearStartDate(): string {
  const now = new Date();
  const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${startYear}-04-01`;
}

interface Props { refreshKey?: number; }

export default function PTOPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside, user } = useApp();
  const toast = useToast();
  const { isOpen: isRequestOpen, onOpen: onRequestOpen, onClose: onRequestClose } = useDisclosure();
  const { isOpen: isDenyOpen, onOpen: onDenyOpen, onClose: onDenyClose } = useDisclosure();
  const { isOpen: isBalanceOpen, onOpen: onBalanceOpen, onClose: onBalanceClose } = useDisclosure();

  const [balances, setBalances]   = useState<BalanceRow[]>([]);
  const [requests, setRequests]   = useState<RequestRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [windows, setWindows]     = useState<HolidayWindows | null>(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId]   = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [managerNote, setManagerNote] = useState('');
  const [approvalScope, setApprovalScope] = useState<'mine' | 'all'>('all');
  const [approvalScopeDefaultApplied, setApprovalScopeDefaultApplied] = useState(false);

  // New request form
  const [newReq, setNewReq] = useState({
    ptoType: 'Vacation', startDate: '', endDate: '', daysRequested: '', notes: '',
  });

  // New balance form — one employee pick drives both the Employee Directory
  // link (for tenure) and the Hailer account (for matching "my balance");
  // there's no field connecting the two workflows, so the Hailer account is
  // auto-suggested by name match and left editable in case it's wrong/missing.
  const [newBalance, setNewBalance] = useState({
    directoryEmployeeId: '', userId: '', leaveYearStart: defaultLeaveYearStartDate(),
  });
  const [balanceSubmitting, setBalanceSubmitting] = useState(false);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');
  const rowHover    = useColorModeValue('gray.50', 'gray.600');
  const mutedText   = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_BALANCES, { update: true }),
      hailer!.insight.data(INSIGHT_REQUESTS, { update: true }),
      hailer!.insight.data(INSIGHT_EMPLOYEE_DIRECTORY, { update: true }),
      hailer!.insight.data(INSIGHT_HOLIDAY_WINDOWS, { update: true }),
    ]).then(([bal, req, emp, win]) => {
      setBalances(parseInsight(bal) as unknown as BalanceRow[]);
      setRequests(parseInsight(req) as unknown as RequestRow[]);
      setEmployees(parseInsight(emp) as unknown as EmployeeRow[]);
      const winRows = parseInsight(win) as unknown as HolidayWindows[];
      setWindows(winRows[0] || null);
      setLoading(false);
    }).catch(err => { console.error(err); setLoading(false); });
  }, [inside, refreshKey]);

  function userName(id: string | null): string {
    if (!id) return '—';
    const u = user.map[id];
    return u ? `${u.firstname} ${u.lastname}` : id;
  }

  const currentUser = user.current;
  const myBalance = balances.find(b => b.employee === currentUser?._id && b.year === currentLeaveYear);
  const currentYearBalances = balances.filter(b => b.year === currentLeaveYear);
  const myRequests = requests.filter(r => r.employee === currentUser?._id);

  const activeDirectoryEmployees = useMemo(
    () => employees
      .filter(e => e.phaseId === ED_PHASE_ACTIVE || e.phaseId === ED_PHASE_CONTRACTOR)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  function handleDirectoryEmployeeChange(id: string) {
    const emp = employees.find(e => e.id === id);
    let matchedId = '';
    if (emp) {
      const targetName = `${emp.firstname || ''} ${emp.lastname || ''}`.trim().toLowerCase();
      const match = Object.values(user.map).find(
        u => `${u.firstname} ${u.lastname}`.trim().toLowerCase() === targetName,
      );
      if (match) matchedId = match._id;
    }
    setNewBalance(prev => ({ ...prev, directoryEmployeeId: id, userId: matchedId }));
  }

  async function submitNewBalance() {
    if (!newBalance.directoryEmployeeId || !newBalance.userId || !newBalance.leaveYearStart) {
      toast({ title: 'Please select an employee, confirm the Hailer account, and set the leave year start', status: 'warning', duration: 3500 });
      return;
    }
    setBalanceSubmitting(true);
    try {
      const emp = employees.find(e => e.id === newBalance.directoryEmployeeId);
      const created = await hailer!.activity.create(WF_BALANCE, [{
        name: `${emp?.name || 'Employee'} — PTO Balance`,
        phaseId: PHASE_BALANCE_ACTIVE,
        fields: {
          [BF_EMPLOYEE]: newBalance.userId,
          [BF_EMPLOYEE_DIRECTORY_LINK]: newBalance.directoryEmployeeId,
          [BF_LEAVE_YEAR_START]: newBalance.leaveYearStart,
          ...Object.fromEntries(BF_QUALIFYING_MONTHS.map(id => [id, 1])),
        },
      }], {});
      if (!created?.[0]?._id) throw new Error('Balance was not created — check Hailer before retrying.');
      toast({ title: 'PTO Balance created', status: 'success', duration: 3000 });
      onBalanceClose();
      setNewBalance({ directoryEmployeeId: '', userId: '', leaveYearStart: defaultLeaveYearStartDate() });
      const bal = await hailer!.insight.data(INSIGHT_BALANCES, { update: true });
      setBalances(parseInsight(bal) as unknown as BalanceRow[]);
    } catch (err) {
      const e = err as { msg?: string; message?: string };
      toast({ title: 'Error creating balance', description: e?.msg || e?.message || String(err), status: 'error', duration: 4000 });
    }
    setBalanceSubmitting(false);
  }

  // Employee Directory has no field linking a record back to an actual Hailer
  // login — so "my direct reports" can only be approximated by matching names.
  // This is a best-effort heuristic, not a guaranteed-correct lookup; the "All"
  // toggle always remains available for anyone who needs the full picture.
  const myDirectReportNames = useMemo(() => {
    if (!currentUser) return new Set<string>();
    const fullName = (f: string | null, l: string | null) => `${f || ''} ${l || ''}`.trim().toLowerCase();
    const myName = fullName(currentUser.firstname, currentUser.lastname);
    const me = employees.find(e => fullName(e.firstname, e.lastname) === myName);
    if (!me) return new Set<string>();
    return new Set(
      employees.filter(e => e.supervisorId === me.id).map(e => (e.name || '').toLowerCase())
    );
  }, [employees, currentUser]);

  useEffect(() => {
    if (approvalScopeDefaultApplied) return;
    if (employees.length === 0 || !currentUser) return;
    if (myDirectReportNames.size > 0) setApprovalScope('mine');
    setApprovalScopeDefaultApplied(true);
  }, [employees.length, currentUser, myDirectReportNames, approvalScopeDefaultApplied]);

  const allPendingRequests = requests.filter(r => r.phase === 'Pending');
  const pendingRequests = approvalScope === 'mine'
    ? allPendingRequests.filter(r => myDirectReportNames.has(userName(r.employee).toLowerCase()))
    : allPendingRequests;

  async function submitRequest() {
    if (!newReq.startDate || !newReq.endDate || !newReq.daysRequested) {
      toast({ title: 'Please fill in all required fields', status: 'warning', duration: 3000 });
      return;
    }
    setSubmitting(true);
    try {
      await hailer!.activity.create(WF_REQUEST, [{
        name: `PTO - ${currentUser?.firstname} ${currentUser?.lastname} - ${newReq.startDate}`,
        phaseId: PHASE_PENDING,
        fields: {
          [RF_EMPLOYEE]: currentUser?._id || '',
          [RF_TYPE]:     newReq.ptoType,
          [RF_START]:    newReq.startDate,
          [RF_END]:      newReq.endDate,
          [RF_DAYS]:     Number(newReq.daysRequested),
          [RF_EMP_NOTE]: newReq.notes,
        },
      }], {});
      toast({ title: 'PTO Request submitted!', status: 'success', duration: 3000 });
      onRequestClose();
      setNewReq({ ptoType: 'Vacation', startDate: '', endDate: '', daysRequested: '', notes: '' });
      // Refresh
      const [bal, req] = await Promise.all([
        hailer!.insight.data(INSIGHT_BALANCES, { update: true }),
        hailer!.insight.data(INSIGHT_REQUESTS, { update: true }),
      ]);
      setBalances(parseInsight(bal) as unknown as BalanceRow[]);
      setRequests(parseInsight(req) as unknown as RequestRow[]);
    } catch (err) {
      toast({ title: 'Error submitting request', description: String(err), status: 'error', duration: 4000 });
    }
    setSubmitting(false);
  }

  async function approveRequest(req: RequestRow) {
    setActionId(req.id);
    try {
      await hailer!.activity.update([{
        _id: req.id,
        phaseId: PHASE_APPROVED,
        fields: { [RF_APPROVED_BY]: currentUser?._id || '' },
      }], {});
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, phase: 'Approved' } : r));
      toast({ title: 'Request Approved', status: 'success', duration: 2000 });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 3000 });
    }
    setActionId(null);
  }

  async function cancelRequest(req: RequestRow) {
    setActionId(req.id);
    try {
      await hailer!.activity.update([{
        _id: req.id,
        phaseId: PHASE_CANCELLED,
        fields: { [RF_APPROVED_BY]: currentUser?._id || '' },
      }], {});
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, phase: 'Cancelled' } : r));
      toast({ title: 'Request Cancelled', status: 'info', duration: 2000 });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 3000 });
    }
    setActionId(null);
  }

  async function denyRequest() {
    if (!selectedRequest) return;
    setActionId(selectedRequest.id);
    try {
      await hailer!.activity.update([{
        _id: selectedRequest.id,
        phaseId: PHASE_DENIED,
        fields: { [RF_MGR_NOTE]: managerNote, [RF_APPROVED_BY]: currentUser?._id || '' },
      }], {});
      setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, phase: 'Denied' } : r));
      toast({ title: 'Request Denied', status: 'warning', duration: 2000 });
      onDenyClose();
      setManagerNote('');
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 3000 });
    }
    setActionId(null);
  }

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;

  return (
    <Box>
      {/* Holiday windows — reference only, not enforced. Editable via the
          "⚙️ PTO Settings" workflow (Kristin/Aki admin). */}
      {windows && (windows.summerStart || windows.winterStart) && (
        <Alert status="info" borderRadius="md" alignItems="flex-start" mb={6}>
          <AlertIcon mt={0.5} />
          <Box fontSize="sm" flex="1">
            <Flex justify="space-between" align="flex-start" gap={2}>
              <Text fontWeight="bold" mb={1}>Holiday windows (reference)</Text>
              <Button size="xs" variant="outline" onClick={() => hailer!.ui.activity.open(windows.id)}>
                Edit settings
              </Button>
            </Flex>
            <Text>
              Summer: <strong>{windows.summerStart} – {windows.summerEnd}</strong>
              {' · '}Winter: <strong>{windows.winterStart} – {windows.winterEnd}</strong>
            </Text>
            {windows.guidanceNote && (
              <Text color={mutedText} mt={1}>{windows.guidanceNote}</Text>
            )}
            {windows.medicalLeaveNote && (
              <>
                <Text fontWeight="bold" mt={3} mb={1}>Sick pay (reference)</Text>
                <Text color={mutedText}>{windows.medicalLeaveNote}</Text>
              </>
            )}
          </Box>
        </Alert>
      )}

      {/* My PTO Balance */}
      <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="sm" p={5} mb={6}>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="sm">My PTO Balance — {currentLeaveYear}</Heading>
          <Button size="sm" colorScheme="blue" onClick={onRequestOpen}>+ Request PTO</Button>
        </Flex>
        {myBalance ? (
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            <Stat><StatLabel>Total Allocated</StatLabel><StatNumber>{myBalance.totalDays || 0}</StatNumber><StatHelpText>days</StatHelpText></Stat>
            <Stat><StatLabel>Used</StatLabel><StatNumber color="red.500">{myBalance.daysUsed || 0}</StatNumber><StatHelpText>days</StatHelpText></Stat>
            <Stat><StatLabel>Pending</StatLabel><StatNumber color="yellow.500">{myBalance.daysPending || 0}</StatNumber><StatHelpText>days</StatHelpText></Stat>
            <Stat><StatLabel>Remaining</StatLabel><StatNumber color="green.500">{myBalance.daysRemaining || 0}</StatNumber><StatHelpText>days</StatHelpText></Stat>
          </SimpleGrid>
        ) : (
          <Text color={mutedText} fontSize="sm">No PTO balance set up for {currentLeaveYear}. Contact your manager.</Text>
        )}
      </Box>

      {/* Pending approvals (manager view) */}
      {allPendingRequests.length > 0 && (
        <Box bg={cardBg} border="1px" borderColor="yellow.300" borderRadius="md" shadow="sm" p={5} mb={6}>
          <Flex justify="space-between" align="center" mb={1} wrap="wrap" gap={2}>
            <Heading size="sm" color="yellow.600">⏳ Pending Approvals ({pendingRequests.length})</Heading>
            {myDirectReportNames.size > 0 && (
              <HStack spacing={2}>
                <Button size="xs" variant={approvalScope === 'mine' ? 'solid' : 'outline'} colorScheme="yellow"
                  onClick={() => setApprovalScope('mine')}>My Team</Button>
                <Button size="xs" variant={approvalScope === 'all' ? 'solid' : 'outline'} colorScheme="yellow"
                  onClick={() => setApprovalScope('all')}>All ({allPendingRequests.length})</Button>
              </HStack>
            )}
          </Flex>
          <Text fontSize="xs" color={mutedText} mb={4}>
            {myDirectReportNames.size > 0
              ? 'Matched to your direct reports by name (Employee Directory has no direct link to Hailer accounts) — use "All" if someone is missing.'
              : 'Showing every pending request — no direct reports found for you in Employee Directory.'}
          </Text>
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Employee</Th>
                <Th>Type</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th isNumeric>Days</Th>
                <Th>Notes</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pendingRequests.map(r => (
                <Tr key={r.id} _hover={{ bg: rowHover }}>
                  <Td fontWeight="medium">{userName(r.employee)}</Td>
                  <Td><Badge colorScheme="blue">{r.ptoType}</Badge></Td>
                  <Td>{fmtDate(r.startDate)}</Td>
                  <Td>{fmtDate(r.endDate)}</Td>
                  <Td isNumeric fontWeight="bold">{r.daysRequested}</Td>
                  <Td maxW="160px" isTruncated>{r.employeeNotes || '—'}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Button size="xs" colorScheme="green" isLoading={actionId === r.id}
                        onClick={() => approveRequest(r)}>Approve</Button>
                      <Button size="xs" colorScheme="red" variant="outline"
                        onClick={() => { setSelectedRequest(r); onDenyOpen(); }}>Deny</Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* All employee balances */}
      <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="sm" p={5} mb={6}>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="sm">All Employee Balances — {currentLeaveYear}</Heading>
          <Button size="sm" colorScheme="blue" onClick={onBalanceOpen}>+ New Balance</Button>
        </Flex>
        {currentYearBalances.length === 0 ? (
          <Text color={mutedText} fontSize="sm">No balances set up yet for {currentLeaveYear}.</Text>
        ) : (
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Employee</Th>
                <Th isNumeric>Total</Th>
                <Th isNumeric>Used</Th>
                <Th isNumeric>Pending</Th>
                <Th isNumeric>Remaining</Th>
              </Tr>
            </Thead>
            <Tbody>
              {currentYearBalances.map(b => (
                <Tr key={b.id} _hover={{ bg: rowHover }} cursor="pointer"
                  onClick={() => hailer!.ui.activity.open(b.id)}>
                  <Td fontWeight="medium">{userName(b.employee)}</Td>
                  <Td isNumeric>{b.totalDays || 0}</Td>
                  <Td isNumeric color="red.500">{b.daysUsed || 0}</Td>
                  <Td isNumeric color="yellow.500">{b.daysPending || 0}</Td>
                  <Td isNumeric color="green.500" fontWeight="bold">{b.daysRemaining || 0}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>

      {/* My requests history */}
      <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="sm" p={5}>
        <Heading size="sm" mb={4}>My PTO History</Heading>
        {myRequests.length === 0 ? (
          <Text color={mutedText} fontSize="sm">No PTO requests found.</Text>
        ) : (
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Type</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th isNumeric>Days</Th>
                <Th>Status</Th>
                <Th>Manager Notes</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {myRequests.map(r => (
                <Tr key={r.id} _hover={{ bg: rowHover }}>
                  <Td cursor="pointer" onClick={() => hailer!.ui.activity.open(r.id)}><Badge colorScheme="blue">{r.ptoType}</Badge></Td>
                  <Td cursor="pointer" onClick={() => hailer!.ui.activity.open(r.id)}>{fmtDate(r.startDate)}</Td>
                  <Td cursor="pointer" onClick={() => hailer!.ui.activity.open(r.id)}>{fmtDate(r.endDate)}</Td>
                  <Td isNumeric fontWeight="bold" cursor="pointer" onClick={() => hailer!.ui.activity.open(r.id)}>{r.daysRequested}</Td>
                  <Td cursor="pointer" onClick={() => hailer!.ui.activity.open(r.id)}><Badge colorScheme={REQUEST_COLOR[r.phase] || 'gray'}>{r.phase}</Badge></Td>
                  <Td maxW="200px" isTruncated cursor="pointer" onClick={() => hailer!.ui.activity.open(r.id)}>{r.managerNotes || '—'}</Td>
                  <Td>
                    {(r.phase === 'Pending' || r.phase === 'Approved') && (
                      <Button size="xs" variant="outline" colorScheme="red" isLoading={actionId === r.id}
                        onClick={() => cancelRequest(r)}>Cancel</Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>

      {/* Request PTO Modal */}
      <Modal isOpen={isRequestOpen} onClose={onRequestClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Request PTO</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">PTO Type</FormLabel>
                <Select value={newReq.ptoType} onChange={e => setNewReq(p => ({ ...p, ptoType: e.target.value }))}>
                  {PTO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Start Date</FormLabel>
                <Input type="date" value={newReq.startDate} onChange={e => setNewReq(p => ({ ...p, startDate: e.target.value }))} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">End Date</FormLabel>
                <Input type="date" value={newReq.endDate} onChange={e => setNewReq(p => ({ ...p, endDate: e.target.value }))} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Number of Days</FormLabel>
                <NumberInput min={0.5}>
                  <NumberInputField value={newReq.daysRequested}
                    onChange={e => setNewReq(p => ({ ...p, daysRequested: e.target.value }))} />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Notes (optional)</FormLabel>
                <Textarea rows={3} value={newReq.notes}
                  onChange={e => setNewReq(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional information..." />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onRequestClose}>Cancel</Button>
            <Button colorScheme="blue" isLoading={submitting} onClick={submitRequest}>Submit Request</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Deny Modal */}
      <Modal isOpen={isDenyOpen} onClose={onDenyClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Deny PTO Request</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={3}>Denying request for <strong>{userName(selectedRequest?.employee || null)}</strong></Text>
            <FormControl>
              <FormLabel fontSize="sm">Reason (optional)</FormLabel>
              <Textarea rows={3} value={managerNote} onChange={e => setManagerNote(e.target.value)}
                placeholder="Reason for denial..." />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDenyClose}>Cancel</Button>
            <Button colorScheme="red" isLoading={actionId === selectedRequest?.id} onClick={denyRequest}>Deny</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Balance Modal */}
      <Modal isOpen={isBalanceOpen} onClose={onBalanceClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>New PTO Balance</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel fontSize="sm">Employee (Directory Record)</FormLabel>
                <Select placeholder="Select employee…" value={newBalance.directoryEmployeeId}
                  onChange={e => handleDirectoryEmployeeChange(e.target.value)}>
                  {activeDirectoryEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
              </FormControl>

              {newBalance.directoryEmployeeId && (
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Hailer Account</FormLabel>
                  <Select value={newBalance.userId}
                    onChange={e => setNewBalance(p => ({ ...p, userId: e.target.value }))}>
                    <option value="">Select account…</option>
                    {Object.values(user.map)
                      .sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`))
                      .map(u => <option key={u._id} value={u._id}>{u.firstname} {u.lastname}</option>)}
                  </Select>
                  {!newBalance.userId ? (
                    <Alert status="warning" fontSize="xs" borderRadius="md" mt={2}>
                      <AlertIcon />
                      No matching Hailer account found automatically — please select one manually.
                    </Alert>
                  ) : (
                    <Text fontSize="xs" color={mutedText} mt={1}>
                      Auto-matched by name — change it above if this isn't right.
                    </Text>
                  )}
                </FormControl>
              )}

              <FormControl isRequired>
                <FormLabel fontSize="sm">Leave Year Start</FormLabel>
                <Input type="date" value={newBalance.leaveYearStart}
                  onChange={e => setNewBalance(p => ({ ...p, leaveYearStart: e.target.value }))} />
                <Text fontSize="xs" color={mutedText} mt={1}>
                  1 April of the leave-earning year this balance covers.
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onBalanceClose}>Cancel</Button>
            <Button colorScheme="blue" isLoading={balanceSubmitting} onClick={submitNewBalance}>Create Balance</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
