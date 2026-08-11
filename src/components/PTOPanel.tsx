import {
  Box, Badge, Button, Divider, Flex, FormControl, FormLabel, Heading,
  HStack, Input, Modal, ModalBody, ModalCloseButton, ModalContent,
  ModalFooter, ModalHeader, ModalOverlay, NumberInput, NumberInputField,
  Select, SimpleGrid, Spinner, Stat, StatHelpText, StatLabel, StatNumber,
  Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue, useDisclosure,
  useToast, VStack, Textarea,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_BALANCES = '6a71804da8140c7b12b1d3c1';
const INSIGHT_REQUESTS = '6a7180504af977ffe55b40f6';

const WF_BALANCE  = '6a717f76a8140c7b12b1ce9e';
const WF_REQUEST  = '6a717f77a8140c7b12b1ceac';
const PHASE_PENDING  = '6a717fac693253992c87719e';
const PHASE_APPROVED = '6a717faf693253992c8771e7';
const PHASE_DENIED   = '6a717fb1693253992c877206';

// PTO Balance field IDs
const BF_EMPLOYEE  = '6a717fe74af977ffe55b3dcb';
const BF_YEAR      = '6a717fe74af977ffe55b3dce';
const BF_TOTAL     = '6a717fe74af977ffe55b3dd1';
const BF_USED      = '6a717fe74af977ffe55b3dd5';
const BF_PENDING   = '6a717fe74af977ffe55b3dd9';
const BF_REMAINING = '6a717fe74af977ffe55b3ddd';

// PTO Request field IDs
const RF_EMPLOYEE  = '6a717fe74af977ffe55b3de5';
const RF_TYPE      = '6a717fe74af977ffe55b3de9';
const RF_START     = '6a717fe74af977ffe55b3ded';
const RF_END       = '6a717fe74af977ffe55b3df1';
const RF_DAYS      = '6a717fe74af977ffe55b3df5';
const RF_EMP_NOTE  = '6a717fe74af977ffe55b3df9';
const RF_MGR_NOTE  = '6a717fe74af977ffe55b3dfd';

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
  'Pending': 'yellow', 'Approved': 'green', 'Denied': 'red',
};

const PTO_TYPES = ['Vacation', 'Sick Leave', 'Personal', 'Public Holiday', 'Other'];
const currentYear = new Date().getFullYear().toString();

interface Props { refreshKey?: number; }

export default function PTOPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside, user } = useApp();
  const toast = useToast();
  const { isOpen: isRequestOpen, onOpen: onRequestOpen, onClose: onRequestClose } = useDisclosure();
  const { isOpen: isDenyOpen, onOpen: onDenyOpen, onClose: onDenyClose } = useDisclosure();

  const [balances, setBalances]   = useState<BalanceRow[]>([]);
  const [requests, setRequests]   = useState<RequestRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId]   = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [managerNote, setManagerNote] = useState('');

  // New request form
  const [newReq, setNewReq] = useState({
    ptoType: 'Vacation', startDate: '', endDate: '', daysRequested: '', notes: '',
  });

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
    ]).then(([bal, req]) => {
      setBalances(parseInsight(bal) as unknown as BalanceRow[]);
      setRequests(parseInsight(req) as unknown as RequestRow[]);
      setLoading(false);
    }).catch(err => { console.error(err); setLoading(false); });
  }, [inside, refreshKey]);

  function userName(id: string | null): string {
    if (!id) return '—';
    const u = user.map[id];
    return u ? `${u.firstname} ${u.lastname}` : id;
  }

  const currentUser = user.current;
  const myBalance = balances.find(b => b.employee === currentUser?._id && b.year === currentYear);
  const pendingRequests = requests.filter(r => r.phase === 'Pending');
  const myRequests = requests.filter(r => r.employee === currentUser?._id);

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
      await hailer!.activity.update([{ _id: req.id, phaseId: PHASE_APPROVED }], {});
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, phase: 'Approved' } : r));
      toast({ title: 'Request Approved', status: 'success', duration: 2000 });
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
        fields: { [RF_MGR_NOTE]: managerNote },
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
      {/* My PTO Balance */}
      <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="sm" p={5} mb={6}>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="sm">My PTO Balance — {currentYear}</Heading>
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
          <Text color={mutedText} fontSize="sm">No PTO balance set up for {currentYear}. Contact your manager.</Text>
        )}
      </Box>

      {/* Pending approvals (manager view) */}
      {pendingRequests.length > 0 && (
        <Box bg={cardBg} border="1px" borderColor="yellow.300" borderRadius="md" shadow="sm" p={5} mb={6}>
          <Heading size="sm" mb={4} color="yellow.600">⏳ Pending Approvals ({pendingRequests.length})</Heading>
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
      {balances.length > 0 && (
        <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="sm" p={5} mb={6}>
          <Heading size="sm" mb={4}>All Employee Balances — {currentYear}</Heading>
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
              {balances.map(b => (
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
        </Box>
      )}

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
              </Tr>
            </Thead>
            <Tbody>
              {myRequests.map(r => (
                <Tr key={r.id} _hover={{ bg: rowHover }} cursor="pointer"
                  onClick={() => hailer!.ui.activity.open(r.id)}>
                  <Td><Badge colorScheme="blue">{r.ptoType}</Badge></Td>
                  <Td>{fmtDate(r.startDate)}</Td>
                  <Td>{fmtDate(r.endDate)}</Td>
                  <Td isNumeric fontWeight="bold">{r.daysRequested}</Td>
                  <Td><Badge colorScheme={REQUEST_COLOR[r.phase] || 'gray'}>{r.phase}</Badge></Td>
                  <Td maxW="200px" isTruncated>{r.managerNotes || '—'}</Td>
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
    </Box>
  );
}
