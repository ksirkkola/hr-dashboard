import {
  Badge, Box, Button, Divider, Flex, FormControl, FormLabel, Heading,
  HStack, Input, Modal, ModalBody, ModalCloseButton, ModalContent,
  ModalFooter, ModalHeader, ModalOverlay, NumberInput, NumberInputField,
  Select, SimpleGrid, Spinner, Stat, StatHelpText, StatLabel, StatNumber,
  Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue,
  useDisclosure, useToast, VStack, Textarea,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_BONUS = '6a71852f891833385a34d7aa';
const WF_BONUS      = '6a7184b34af977ffe55b4dc7';
const PHASE_DRAFT   = '6a7184e8693253992c87ad61';
const PHASE_APPROVED = '6a7184ea693253992c87ad7f';
const PHASE_PAID    = '6a7184ed693253992c87adcc';

// Field IDs
const BF_EMPLOYEE   = '6a7184f04af977ffe55b4f0d';
const BF_ROLE       = '6a7184f04af977ffe55b4f11';
const BF_QUARTER    = '6a7184f14af977ffe55b4f14';
const BF_YEAR       = '6a7184f14af977ffe55b4f19';
const BF_SALARY     = '6a7184f14af977ffe55b4f27';
const BF_TIER       = '6a7184f14af977ffe55b4f2c';
const BF_COMPANY    = '6a7184f14af977ffe55b4f33';
const BF_TEAM       = '6a7184f24af977ffe55b4f38';
const BF_INDIVIDUAL = '6a7184f24af977ffe55b4f40';
const BF_WEIGHTED   = '6a7184f24af977ffe55b4f44';
const BF_BASE       = '6a7184f24af977ffe55b4f50';
const BF_MULTIPLIER = '6a7184f24af977ffe55b4f54';
const BF_CALCULATED = '6a7184f34af977ffe55b4f58';
const BF_COMMISSION = '6a7184f34af977ffe55b4f5b';
const BF_TOTAL      = '6a7184f34af977ffe55b4f5f';
const BF_NOTES      = '6a7184f34af977ffe55b4f64';
const BF_PAYMENT    = '6a7184f34af977ffe55b4f68';

const TIER_RATES: Record<string, number> = {
  'Meets Expectations (5%)': 0.05,
  'Exceeds Expectations (8%)': 0.08,
  'Outstanding (10%)': 0.10,
  'Exceptional (15%)': 0.15,
};

const ROLE_WEIGHTS: Record<string, { company: number; team: number; individual: number }> = {
  'Sales':          { company: 0.40, team: 0.20, individual: 0.40 },
  'Support':        { company: 0.40, team: 0.30, individual: 0.30 },
  'Administration': { company: 0.40, team: 0.30, individual: 0.30 },
};

function fmt(val: unknown): string {
  const n = Number(val);
  if (!val || isNaN(n) || n === 0) return '—';
  return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
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

const PHASE_COLOR: Record<string, string> = {
  'Draft': 'gray', 'Approved': 'green', 'Paid': 'blue',
};

const currentYear = new Date().getFullYear().toString();
const currentQ = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

interface Props { refreshKey?: number; }

export default function BonusPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside, user } = useApp();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [rows, setRows]         = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [form, setForm] = useState({
    employeeId: '', role: 'Sales', quarter: currentQ, year: currentYear,
    annualSalary: '', bonusTier: 'Meets Expectations (5%)',
    companyScore: '', teamScore: '', individualScore: '',
    salesCommission: '', managerNotes: '',
  });

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');
  const rowHover    = useColorModeValue('gray.50', 'gray.600');
  const mutedText   = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    hailer!.insight.data(INSIGHT_BONUS, { update: true })
      .then(data => { setRows(parseInsight(data)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [inside, refreshKey]);

  function userName(id: string | null): string {
    if (!id) return '—';
    const u = user.map[id];
    return u ? `${u.firstname} ${u.lastname}` : id;
  }

  // Calculate bonus fields from form
  function calcBonus() {
    const salary   = Number(form.annualSalary) || 0;
    const rate     = TIER_RATES[form.bonusTier] || 0.05;
    const weights  = ROLE_WEIGHTS[form.role] || ROLE_WEIGHTS['Administration'];
    const cScore   = Number(form.companyScore) || 0;
    const tScore   = Number(form.teamScore) || 0;
    const iScore   = Number(form.individualScore) || 0;
    const weighted = Math.round(cScore * weights.company + tScore * weights.team + iScore * weights.individual);
    const base     = Math.round((salary * rate) / 4);
    const multiplier = weighted / 100;
    const calculated = Math.round(base * multiplier);
    const commission = Number(form.salesCommission) || 0;
    const total      = calculated + commission;
    return { weighted, base, multiplier, calculated, total };
  }

  const calc = calcBonus();

  async function submitBonus() {
    if (!form.employeeId) {
      toast({ title: 'Please select an employee', status: 'warning', duration: 3000 });
      return;
    }
    setSubmitting(true);
    try {
      const { weighted, base, multiplier, calculated, total } = calc;
      await hailer!.activity.create(WF_BONUS, [{
        name: `Bonus — ${userName(form.employeeId)} — ${form.quarter} ${form.year}`,
        phaseId: PHASE_DRAFT,
        fields: {
          [BF_EMPLOYEE]:   form.employeeId,
          [BF_ROLE]:       form.role,
          [BF_QUARTER]:    form.quarter,
          [BF_YEAR]:       form.year,
          [BF_SALARY]:     Number(form.annualSalary),
          [BF_TIER]:       form.bonusTier,
          [BF_COMPANY]:    Number(form.companyScore),
          [BF_TEAM]:       Number(form.teamScore),
          [BF_INDIVIDUAL]: Number(form.individualScore),
          [BF_WEIGHTED]:   weighted,
          [BF_BASE]:       base,
          [BF_MULTIPLIER]: multiplier,
          [BF_CALCULATED]: calculated,
          [BF_COMMISSION]: Number(form.salesCommission) || 0,
          [BF_TOTAL]:      total,
          [BF_NOTES]:      form.managerNotes,
        },
      }], {});
      toast({ title: 'Bonus record created!', status: 'success', duration: 3000 });
      onClose();
      const data = await hailer!.insight.data(INSIGHT_BONUS, { update: true });
      setRows(parseInsight(data));
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000 });
    }
    setSubmitting(false);
  }

  async function movePhase(id: string, phaseId: string, phaseName: string) {
    setActionId(id);
    try {
      await hailer!.activity.update([{ _id: id, phaseId }], {});
      setRows(prev => prev.map(r => r.id === id ? { ...r, phase: phaseName } : r));
      toast({ title: `Moved to ${phaseName}`, status: 'success', duration: 2000 });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 3000 });
    }
    setActionId(null);
  }

  // Summary totals
  const totalApproved = rows.filter(r => r.phase === 'Approved').reduce((s, r) => s + (Number(r.totalPayout) || 0), 0);
  const totalPaid     = rows.filter(r => r.phase === 'Paid').reduce((s, r) => s + (Number(r.totalPayout) || 0), 0);
  const pending       = rows.filter(r => r.phase === 'Draft').length;

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;

  const employees = Object.values(user.map);

  return (
    <Box>
      {/* Summary */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="gray.400">
          <Stat><StatLabel>Draft Records</StatLabel><StatNumber>{pending}</StatNumber><StatHelpText>Awaiting approval</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Approved</StatLabel><StatNumber fontSize="lg">{fmt(totalApproved)}</StatNumber><StatHelpText>Total payout</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="blue.400">
          <Stat><StatLabel>Paid</StatLabel><StatNumber fontSize="lg">{fmt(totalPaid)}</StatNumber><StatHelpText>All time</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Flex h="100%" align="center">
            <Button colorScheme="blue" size="sm" width="full" onClick={onOpen}>+ New Bonus Record</Button>
          </Flex>
        </Box>
      </SimpleGrid>

      {/* Bonus records table */}
      {rows.length === 0 ? (
        <Text color={mutedText}>No bonus records yet. Click "New Bonus Record" to create one.</Text>
      ) : (
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Employee</Th>
                <Th>Role</Th>
                <Th>Period</Th>
                <Th>Tier</Th>
                <Th isNumeric>Weighted</Th>
                <Th isNumeric>Bonus</Th>
                <Th isNumeric>Commission</Th>
                <Th isNumeric>Total</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map(r => (
                <Tr key={r.id as string} _hover={{ bg: rowHover }} cursor="pointer"
                  onClick={() => hailer!.ui.activity.open(r.id as string)}>
                  <Td fontWeight="medium">{userName(r.employee as string)}</Td>
                  <Td>{String(r.role || '—')}</Td>
                  <Td whiteSpace="nowrap">{String(r.quarter || '')} {String(r.year || '')}</Td>
                  <Td maxW="140px" isTruncated fontSize="xs">{String(r.bonusTier || '—')}</Td>
                  <Td isNumeric>{r.weightedScore ? `${r.weightedScore}%` : '—'}</Td>
                  <Td isNumeric>{fmt(r.calculatedBonus)}</Td>
                  <Td isNumeric>{fmt(r.salesCommission)}</Td>
                  <Td isNumeric fontWeight="bold">{fmt(r.totalPayout)}</Td>
                  <Td><Badge colorScheme={PHASE_COLOR[r.phase as string] || 'gray'}>{String(r.phase)}</Badge></Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <HStack spacing={1}>
                      {r.phase === 'Draft' && (
                        <Button size="xs" colorScheme="green" isLoading={actionId === r.id}
                          onClick={() => movePhase(r.id as string, PHASE_APPROVED, 'Approved')}>Approve</Button>
                      )}
                      {r.phase === 'Approved' && (
                        <Button size="xs" colorScheme="blue" isLoading={actionId === r.id}
                          onClick={() => movePhase(r.id as string, PHASE_PAID, 'Paid')}>Mark Paid</Button>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* New Bonus Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>New Bonus Record</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <SimpleGrid columns={2} spacing={4} w="full">
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Employee</FormLabel>
                  <Select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}>
                    <option value="">Select employee...</option>
                    {employees.map(u => <option key={u._id} value={u._id}>{u.firstname} {u.lastname}</option>)}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Role</FormLabel>
                  <Select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                    <option>Sales</option>
                    <option>Support</option>
                    <option>Administration</option>
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Quarter</FormLabel>
                  <Select value={form.quarter} onChange={e => setForm(p => ({ ...p, quarter: e.target.value }))}>
                    <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option>
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Year</FormLabel>
                  <Input value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Annual Salary (€)</FormLabel>
                  <NumberInput min={0}>
                    <NumberInputField value={form.annualSalary} onChange={e => setForm(p => ({ ...p, annualSalary: e.target.value }))} />
                  </NumberInput>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Bonus Tier</FormLabel>
                  <Select value={form.bonusTier} onChange={e => setForm(p => ({ ...p, bonusTier: e.target.value }))}>
                    {Object.keys(TIER_RATES).map(t => <option key={t}>{t}</option>)}
                  </Select>
                </FormControl>
              </SimpleGrid>

              <Divider />
              <Text fontWeight="semibold" fontSize="sm" alignSelf="start">Performance Scores (0–100)</Text>
              <Text fontSize="xs" color={mutedText} alignSelf="start">
                Weights for {form.role}: Company {ROLE_WEIGHTS[form.role]?.company * 100}% / Team {ROLE_WEIGHTS[form.role]?.team * 100}% / Individual {ROLE_WEIGHTS[form.role]?.individual * 100}%
              </Text>

              <SimpleGrid columns={3} spacing={4} w="full">
                <FormControl>
                  <FormLabel fontSize="sm">Company</FormLabel>
                  <NumberInput min={0} max={100}>
                    <NumberInputField value={form.companyScore} onChange={e => setForm(p => ({ ...p, companyScore: e.target.value }))} placeholder="0-100" />
                  </NumberInput>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Team</FormLabel>
                  <NumberInput min={0} max={100}>
                    <NumberInputField value={form.teamScore} onChange={e => setForm(p => ({ ...p, teamScore: e.target.value }))} placeholder="0-100" />
                  </NumberInput>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Individual</FormLabel>
                  <NumberInput min={0} max={100}>
                    <NumberInputField value={form.individualScore} onChange={e => setForm(p => ({ ...p, individualScore: e.target.value }))} placeholder="0-100" />
                  </NumberInput>
                </FormControl>
              </SimpleGrid>



              {form.role === 'Sales' && (
                <FormControl>
                  <FormLabel fontSize="sm">Sales Commission (€) <Text as="span" color="gray.400" fontWeight="normal">— optional, add later if unknown</Text></FormLabel>
                  <NumberInput min={0}>
                    <NumberInputField value={form.salesCommission} onChange={e => setForm(p => ({ ...p, salesCommission: e.target.value }))} placeholder="0" />
                  </NumberInput>
                </FormControl>
              )}

              <FormControl>
                <FormLabel fontSize="sm">Manager Notes</FormLabel>
                <Textarea rows={2} value={form.managerNotes} onChange={e => setForm(p => ({ ...p, managerNotes: e.target.value }))} />
              </FormControl>

              {/* Live calculation preview */}
              {form.annualSalary && form.companyScore && (
                <Box w="full" bg={useColorModeValue('blue.50', 'blue.900')} borderRadius="md" p={4} border="1px" borderColor="blue.200">
                  <Text fontWeight="semibold" fontSize="sm" mb={2}>Calculation Preview</Text>
                  <SimpleGrid columns={2} spacing={2} fontSize="sm">
                    <Text color={mutedText}>Weighted Score:</Text><Text fontWeight="bold">{calc.weighted}%</Text>
                    <Text color={mutedText}>Base Quarterly:</Text><Text fontWeight="bold">{fmt(calc.base)}</Text>
                    <Text color={mutedText}>Calculated Bonus:</Text><Text fontWeight="bold">{fmt(calc.calculated)}</Text>
                    {form.role === 'Sales' && form.salesCommission && <><Text color={mutedText}>Commission:</Text><Text fontWeight="bold">{fmt(Number(form.salesCommission))}</Text></>}
                    <Text color={mutedText} fontWeight="bold">Total Payout:</Text><Text fontWeight="bold" color="green.500">{fmt(calc.total)}</Text>
                  </SimpleGrid>
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="blue" isLoading={submitting} onClick={submitBonus}>Create Draft</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
