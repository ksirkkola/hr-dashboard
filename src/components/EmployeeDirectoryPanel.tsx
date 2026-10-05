import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, Divider, Flex, FormControl, FormLabel, Input,
  Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  NumberInput, NumberInputField, Select, SimpleGrid, Spinner, Table, Tbody, Td, Text, Textarea,
  Th, Thead, Tr, VStack, useColorModeValue, useDisclosure, useToast,
} from '@chakra-ui/react';
import { useApp } from '../hailer/use-app';
import { formatDate, formatNextAnniversary, formatTenure } from '../tenure';

const INSIGHT_ALL_EMPLOYEES = '6ac32cf115b5a228afcd672d';
const INSIGHT_SALARY_HISTORY = '6ac33fcc15b5a228afcdd69a';
const INSIGHT_BONUS = '6a71852f891833385a34d7aa';

const WF_SALARY_HISTORY = '6ac33f4c51e0c3d87f5a4bca';
const PHASE_RECORDED = '6ac33f4c51e0c3d87f5a4bc9';
const SH_EMPLOYEE = '6ac33f75aa18bd6372b6f436';
const SH_EFFECTIVE_DATE = '6ac33f75aa18bd6372b6f439';
const SH_SALARY = '6ac33f75aa18bd6372b6f43c';
const SH_CHANGE_TYPE = '6ac33f75aa18bd6372b6f43f';
const SH_REASON = '6ac33f75aa18bd6372b6f442';

const ED_HR_NOTES = '6ac33de6aeab937d3d407958';

const CHANGE_TYPES = ['Starting Salary', 'Annual Review', 'Promotion', 'Market Adjustment', 'Correction', 'Other'];

interface EmployeeRow {
  id: string;
  name: string;
  phaseName: string | null;
  startingDate: number | null;
  positionName: string | null;
  teamName: string | null;
  supervisorId: string | null;
  employmentType: string | null;
  workingHours: string | null;
  workEmail: string | null;
  workPhone: string | null;
  homeAddress: string | null;
  emergencyContact: string | null;
  benefits: string | null;
  status: string | null;
  hrNotes: string | null;
  matchedUserId: string | null;
}

interface SalaryEntry {
  id: string;
  employeeId: string | null;
  effectiveDate: number | null;
  salary: number | null;
  changeType: string | null;
  reason: string | null;
}

interface BonusEntry {
  employee: string | null;
  quarter: string | null;
  year: string | null;
  bonusTier: string | null;
  totalPayout: number | null;
  paymentDate: number | null;
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

function fmtEUR(val: unknown): string {
  const n = Number(val);
  if (!val || isNaN(n)) return '—';
  return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** Custom date fields come back from insights in SECONDS. */
function fmtDateSec(val: unknown): string {
  if (!val || isNaN(Number(val))) return '—';
  return new Date(Number(val) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  return (
    <Box>
      <Text fontSize="xs" color={mutedText}>{label}</Text>
      <Text fontSize="sm" fontWeight="medium" whiteSpace="pre-wrap">{value || '—'}</Text>
    </Box>
  );
}

interface Props { refreshKey?: number }

export default function EmployeeDirectoryPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside } = useApp();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryEntry[]>([]);
  const [bonusHistory, setBonusHistory] = useState<BonusEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const [salaryForm, setSalaryForm] = useState({ effectiveDate: '', salary: '', changeType: CHANGE_TYPES[0], reason: '' });
  const [savingSalary, setSavingSalary] = useState(false);

  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg = useColorModeValue('gray.50', 'gray.800');
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const hoverBg = useColorModeValue('gray.50', 'gray.600');

  function load() {
    if (!inside || !hailer) return;
    setLoading(true);
    Promise.all([
      hailer.insight.data(INSIGHT_ALL_EMPLOYEES, { update: true }),
      hailer.insight.data(INSIGHT_SALARY_HISTORY, { update: true }),
      hailer.insight.data(INSIGHT_BONUS, { update: true }),
    ]).then(([empData, salData, bonusData]) => {
      const rows = parseInsight(empData).map(r => ({
        id: r.id as string,
        name: r.name as string,
        phaseName: (r.phaseName as string) || null,
        startingDate: (r.startingDate as number) || null,
        positionName: (r.positionName as string) || null,
        teamName: (r.teamName as string) || null,
        supervisorId: (r.supervisorId as string) || null,
        employmentType: (r.employmentType as string) || null,
        workingHours: (r.workingHours as string) || null,
        workEmail: (r.workEmail as string) || null,
        workPhone: (r.workPhone as string) || null,
        homeAddress: (r.homeAddress as string) || null,
        emergencyContact: (r.emergencyContact as string) || null,
        benefits: (r.benefits as string) || null,
        status: (r.status as string) || null,
        hrNotes: (r.hrNotes as string) || null,
        matchedUserId: (r.matchedUserId as string) || null,
      })) as EmployeeRow[];
      setEmployees(rows);
      setSelectedId(prev => prev && rows.some(r => r.id === prev) ? prev : (rows[0]?.id ?? null));

      setSalaryHistory(parseInsight(salData).map(r => ({
        id: r.id as string,
        employeeId: (r.employeeId as string) || null,
        effectiveDate: (r.effectiveDate as number) || null,
        salary: (r.salary as number) ?? null,
        changeType: (r.changeType as string) || null,
        reason: (r.reason as string) || null,
      })));

      setBonusHistory(parseInsight(bonusData).map(r => ({
        employee: (r.employee as string) || null,
        quarter: (r.quarter as string) || null,
        year: (r.year as string) || null,
        bonusTier: (r.bonusTier as string) || null,
        totalPayout: (r.totalPayout as number) ?? null,
        paymentDate: (r.paymentDate as number) || null,
      })));

      setLoading(false);
    }).catch(err => { setError(String(err)); setLoading(false); });
  }

  useEffect(load, [inside, hailer, refreshKey]);

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    employees.forEach(e => { m[e.id] = e.name; });
    return m;
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e =>
      e.name.toLowerCase().includes(q)
      || (e.positionName || '').toLowerCase().includes(q)
      || (e.teamName || '').toLowerCase().includes(q));
  }, [employees, search]);

  const selected = useMemo(() => employees.find(e => e.id === selectedId) || null, [employees, selectedId]);

  const selectedSalaryHistory = useMemo(
    () => salaryHistory
      .filter(s => s.employeeId === selectedId)
      .sort((a, b) => (b.effectiveDate || 0) - (a.effectiveDate || 0)),
    [salaryHistory, selectedId],
  );

  const selectedBonusHistory = useMemo(
    () => !selected?.matchedUserId ? [] : bonusHistory
      .filter(b => b.employee === selected.matchedUserId)
      .sort((a, b) => (b.paymentDate || 0) - (a.paymentDate || 0)),
    [bonusHistory, selected],
  );

  useEffect(() => {
    setNotesDraft(selected?.hrNotes || '');
    setNotesDirty(false);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveNotes() {
    if (!selected || !hailer) return;
    setSavingNotes(true);
    try {
      await hailer.activity.update([{ _id: selected.id, fields: { [ED_HR_NOTES]: notesDraft } }], {});
      setEmployees(prev => prev.map(e => e.id === selected.id ? { ...e, hrNotes: notesDraft } : e));
      setNotesDirty(false);
      toast({ title: 'Notes saved', status: 'success', duration: 2000 });
    } catch (err) {
      toast({ title: 'Error saving notes', description: String(err), status: 'error', duration: 4000 });
    }
    setSavingNotes(false);
  }

  function openSalaryModal() {
    setSalaryForm({
      effectiveDate: new Date().toISOString().slice(0, 10),
      salary: '',
      changeType: CHANGE_TYPES[0],
      reason: '',
    });
    onOpen();
  }

  async function submitSalaryChange() {
    if (!selected || !hailer) return;
    const salaryNum = Number(salaryForm.salary);
    if (!salaryForm.effectiveDate || !salaryNum || salaryNum <= 0) {
      toast({ title: 'Enter an effective date and a salary amount', status: 'warning', duration: 3000 });
      return;
    }
    setSavingSalary(true);
    try {
      // Log the historical entry.
      await hailer.activity.create(WF_SALARY_HISTORY, [{
        name: `${selected.name} — ${salaryForm.changeType} (${salaryForm.effectiveDate})`,
        phaseId: PHASE_RECORDED,
        fields: {
          [SH_EMPLOYEE]: selected.id,
          [SH_EFFECTIVE_DATE]: salaryForm.effectiveDate,
          [SH_SALARY]: String(salaryNum),
          [SH_CHANGE_TYPE]: salaryForm.changeType,
          ...(salaryForm.reason.trim() ? { [SH_REASON]: salaryForm.reason.trim() } : {}),
        },
      }], {});

      toast({ title: 'Salary change recorded', status: 'success', duration: 2500 });
      onClose();
      load();
    } catch (err) {
      toast({ title: 'Error recording salary change', description: String(err), status: 'error', duration: 4000 });
    }
    setSavingSalary(false);
  }

  if (loading) return <Flex justify="center" py={12}><Spinner size="lg" /></Flex>;
  if (error) return <Text color="red.500">{error}</Text>;

  return (
    <Flex gap={6} align="flex-start" wrap={{ base: 'wrap', lg: 'nowrap' }}>
      <Box w={{ base: '100%', lg: '280px' }} flexShrink={0}>
        <Input
          size="sm" mb={3} placeholder="Search employees..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <VStack align="stretch" spacing={1} border="1px" borderColor={borderColor} borderRadius="md" overflow="hidden">
          {filtered.length === 0 ? (
            <Text fontSize="sm" color={mutedText} p={3}>No employees match.</Text>
          ) : (
            filtered.map(e => (
              <Box
                key={e.id}
                px={3} py={2} cursor="pointer"
                bg={e.id === selectedId ? selectedBg : undefined}
                _hover={{ bg: e.id === selectedId ? selectedBg : hoverBg }}
                onClick={() => setSelectedId(e.id)}
                borderBottom="1px" borderColor={borderColor}
                sx={{ '&:last-child': { borderBottom: 'none' } }}
              >
                <Text fontSize="sm" fontWeight={e.id === selectedId ? 'semibold' : 'medium'}>{e.name}</Text>
                <Text fontSize="xs" color={mutedText}>{e.positionName || '—'}</Text>
              </Box>
            ))
          )}
        </VStack>
        <Text fontSize="xs" color={mutedText} mt={2}>
          {filtered.length} of {employees.length} active employee{employees.length === 1 ? '' : 's'}
        </Text>
      </Box>

      <Box flex={1} minW={0}>
        {!selected ? (
          <Text color={mutedText} fontSize="sm">Select an employee to see their details.</Text>
        ) : (
          <VStack align="stretch" spacing={5}>
            <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={5}>
              <Flex justify="space-between" align="flex-start" mb={4} wrap="wrap" gap={2}>
                <Box>
                  <Text fontSize="lg" fontWeight="semibold">{selected.name}</Text>
                  <Text fontSize="sm" color={mutedText}>{selected.positionName || '—'} · {selected.teamName || '—'}</Text>
                </Box>
                {selected.status && (
                  <Badge colorScheme={selected.status === 'Active' ? 'green' : 'orange'}>{selected.status}</Badge>
                )}
              </Flex>

              <Text fontSize="xs" fontWeight="semibold" color={mutedText} textTransform="uppercase" mb={3}>
                Employment
              </Text>
              <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={4}>
                <Field label="Start Date" value={formatDate(selected.startingDate)} />
                <Field label="Years of Service" value={formatTenure(selected.startingDate)} />
                <Field label="Next Anniversary" value={formatNextAnniversary(selected.startingDate)} />
              </SimpleGrid>
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
                <Field label="Position" value={selected.positionName} />
                <Field label="Team" value={selected.teamName} />
                {selected.supervisorId && (
                  <Field label="Supervisor" value={nameById[selected.supervisorId] || selected.supervisorId} />
                )}
                <Field label="Employment Type" value={selected.employmentType} />
                <Field label="Working Hours" value={selected.workingHours} />
              </SimpleGrid>

              <Divider my={4} />

              <Text fontSize="xs" fontWeight="semibold" color={mutedText} textTransform="uppercase" mb={3}>
                Contact
              </Text>
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
                <Field label="Work Email" value={selected.workEmail} />
                <Field label="Work Phone" value={selected.workPhone} />
                <Field label="Emergency Contact (ICE)" value={selected.emergencyContact} />
              </SimpleGrid>
              <SimpleGrid columns={1} spacing={4} mb={selected.benefits ? 4 : 0}>
                <Field label="Home Address" value={selected.homeAddress} />
              </SimpleGrid>
              {selected.benefits && (
                <Box>
                  <Text fontSize="xs" color={mutedText}>Benefits</Text>
                  <Text fontSize="sm" fontWeight="medium" whiteSpace="pre-wrap">{selected.benefits}</Text>
                </Box>
              )}
            </Box>

            <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={5}>
              <Flex justify="space-between" align="center" mb={3}>
                <Text fontSize="xs" fontWeight="semibold" color={mutedText} textTransform="uppercase">
                  HR Notes
                </Text>
                <Text fontSize="xs" color={mutedText}>Not visible to the employee</Text>
              </Flex>
              <Textarea
                rows={4} value={notesDraft} placeholder="Performance context, agreements, reminders..."
                onChange={e => { setNotesDraft(e.target.value); setNotesDirty(true); }}
              />
              <Flex justify="flex-end" mt={2}>
                <Button size="sm" colorScheme="blue" isDisabled={!notesDirty} isLoading={savingNotes} onClick={saveNotes}>
                  Save Notes
                </Button>
              </Flex>
            </Box>

            <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={5}>
              <Flex justify="space-between" align="center" mb={3}>
                <Text fontSize="xs" fontWeight="semibold" color={mutedText} textTransform="uppercase">
                  Salary History
                </Text>
                <Button size="xs" colorScheme="green" variant="outline" onClick={openSalaryModal}>+ Record Change</Button>
              </Flex>
              {selectedSalaryHistory.length === 0 ? (
                <Text fontSize="sm" color={mutedText}>No salary changes recorded yet.</Text>
              ) : (
                <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
                  <Table variant="simple" size="sm">
                    <Thead bg={theadBg}>
                      <Tr>
                        <Th>Effective Date</Th>
                        <Th>Salary</Th>
                        <Th>Type</Th>
                        <Th>Reason</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {selectedSalaryHistory.map(s => (
                        <Tr key={s.id}>
                          <Td fontSize="sm">{fmtDateSec(s.effectiveDate)}</Td>
                          <Td fontSize="sm" fontWeight="medium">{fmtEUR(s.salary)}</Td>
                          <Td><Badge colorScheme="purple">{s.changeType || '—'}</Badge></Td>
                          <Td fontSize="sm">{s.reason || '—'}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
              <Text fontSize="xs" color={mutedText} mt={2}>
                This is a historical log — correct a mistake with a new entry, don't edit an old one.
                Remember to also update the Salary field on the Employee Directory activity itself if this is the new current rate.
              </Text>
            </Box>

            <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={5}>
              <Text fontSize="xs" fontWeight="semibold" color={mutedText} textTransform="uppercase" mb={3}>
                Bonus History
              </Text>
              {!selected.matchedUserId ? (
                <Text fontSize="sm" color={mutedText}>
                  No linked user account on file for this employee yet, so bonus records can't be matched.
                </Text>
              ) : selectedBonusHistory.length === 0 ? (
                <Text fontSize="sm" color={mutedText}>No bonus records yet.</Text>
              ) : (
                <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
                  <Table variant="simple" size="sm">
                    <Thead bg={theadBg}>
                      <Tr>
                        <Th>Quarter</Th>
                        <Th>Tier</Th>
                        <Th>Total Payout</Th>
                        <Th>Payment Date</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {selectedBonusHistory.map((b, i) => (
                        <Tr key={i}>
                          <Td fontSize="sm">{b.quarter} {b.year}</Td>
                          <Td><Badge colorScheme="cyan">{b.bonusTier || '—'}</Badge></Td>
                          <Td fontSize="sm" fontWeight="medium">{fmtEUR(b.totalPayout)}</Td>
                          <Td fontSize="sm">{fmtDateSec(b.paymentDate)}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </Box>
          </VStack>
        )}
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Record Salary Change — {selected?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">Effective Date</FormLabel>
              <Input type="date" value={salaryForm.effectiveDate}
                onChange={e => setSalaryForm(p => ({ ...p, effectiveDate: e.target.value }))} />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">New Monthly Salary (€)</FormLabel>
              <NumberInput value={salaryForm.salary} min={0}
                onChange={v => setSalaryForm(p => ({ ...p, salary: v }))}>
                <NumberInputField placeholder="e.g. 4800" />
              </NumberInput>
            </FormControl>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">Change Type</FormLabel>
              <Select value={salaryForm.changeType}
                onChange={e => setSalaryForm(p => ({ ...p, changeType: e.target.value }))}>
                {CHANGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Reason / Notes</FormLabel>
              <Textarea rows={3} value={salaryForm.reason}
                onChange={e => setSalaryForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Why is this changing?" />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="blue" isLoading={savingSalary} onClick={submitSalaryChange}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
}
