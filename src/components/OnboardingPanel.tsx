import {
  Badge, Box, Button, Flex, FormControl, FormLabel, HStack,
  Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Select, SimpleGrid, Spinner, Stat, StatHelpText, StatLabel,
  StatNumber, Table, Tbody, Td, Text, Th, Thead, Tr, Textarea,
  useColorModeValue, useDisclosure, useToast, VStack, Wrap,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_ONBOARDING = '6a9ab5cc22011b30d04b1abc';
const WF_ONBOARDING = '6a4b9b64fd37515ffb36cd85';
const PHASE_ONBOARDING = '6a4b9b64fd37515ffb36cd8d';

// Checklist item field IDs
const F_COMPUTER    = '6a4b9b64fd37515ffb36cd86';
const F_EMAIL        = '6a4b9b64fd37515ffb36cd87';
const F_HAILER        = '6a4b9b64fd37515ffb36cd88';
const F_OTHER_IT      = '6a4b9b64fd37515ffb36cd89';
const F_CREDIT_CARD  = '6a4b9b64fd37515ffb36cd8a';
const F_CONTRACT     = '6a9ab4bf20b2c43481f89454';
const F_ACCESS       = '6a9ab4bf20b2c43481f89458';
const F_BANK         = '6a9ab4bf20b2c43481f8945b';
const F_TAX_CARD     = '6a9ab4bf20b2c43481f8945f';
const F_WELCOME      = '6a9ab4bf20b2c43481f89462';
const F_TRAINING     = '6a9ab75720b2c43481f8a123';
const F_TRAINING_2   = '6a9b20f120b2c43481fa5f6d';
const F_PENSION      = '6a9b1fe6ed1791be001fc724';
const F_PASSPORT     = '6a9b22ab20b2c43481fa6486';
const F_MEDICAL_INS  = '6a9eb1d62015b0375800315e';

const OPTIONS = ['Yes 🟢', 'Not needed 🟢', 'No 🅾️'];

const CHECKLIST_ITEMS: { key: string; fieldId: string; label: string }[] = [
  { key: 'computerOrdered', fieldId: F_COMPUTER, label: 'Computer ordered' },
  { key: 'emailSetUp', fieldId: F_EMAIL, label: 'Email set up' },
  { key: 'hailerProfileSetUp', fieldId: F_HAILER, label: 'Hailer profile set up' },
  { key: 'creditCardOrdered', fieldId: F_CREDIT_CARD, label: 'Credit Card ordered' },
  { key: 'employmentContractSigned', fieldId: F_CONTRACT, label: 'Employment contract signed' },
  { key: 'buildingAccessGranted', fieldId: F_ACCESS, label: 'Building access granted' },
  { key: 'bankDetailsCollected', fieldId: F_BANK, label: 'Bank details collected' },
  { key: 'taxCardReceived', fieldId: F_TAX_CARD, label: 'Tax card received' },
  { key: 'copyOfPassport', fieldId: F_PASSPORT, label: 'Passport' },
  { key: 'pensionInsuranceEnrollments', fieldId: F_PENSION, label: 'Pension and Insurance Enrollments (TyEL)' },
  { key: 'medicalInsurance', fieldId: F_MEDICAL_INS, label: 'Medical Insurance' },
  { key: 'welcomeMeetingScheduled', fieldId: F_WELCOME, label: 'Welcome meeting scheduled' },
  { key: 'handsOnTrainingBuddyTrip', fieldId: F_TRAINING, label: 'Hands-on Training (Buddy Trip #1)' },
  { key: 'handsOnTrainingBuddyTrip2', fieldId: F_TRAINING_2, label: 'Hands-on Training (Buddy Trip #2)' },
];

interface OnboardingRow {
  id: string;
  personName: string;
  responsibleName: string;
  otherITNeeds: string | null;
  outstandingItems: number;
  [key: string]: unknown;
}

function statusColor(value: unknown): string {
  const v = String(value || '');
  if (v.includes('🅾️')) return 'red';
  if (v.includes('🟢')) return 'green';
  return 'gray';
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): OnboardingRow[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r as unknown as OnboardingRow;
  });
}

interface Props { refreshKey?: number; onRefresh?: () => void }

export default function OnboardingPanel({ refreshKey = 0, onRefresh }: Props) {
  const { hailer, inside } = useApp();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<OnboardingRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [otherITNeeds, setOtherITNeeds] = useState('');

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');
  const rowHover    = useColorModeValue('gray.50', 'gray.600');
  const mutedText   = useColorModeValue('gray.500', 'gray.400');

  function load() {
    if (!inside) return;
    setLoading(true);
    hailer!.insight.data(INSIGHT_ONBOARDING, { update: true })
      .then(data => { setRows(parseInsight(data)); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }

  useEffect(load, [inside, refreshKey]);

  async function createChecklist() {
    setCreating(true);
    try {
      const created = await hailer!.ui.activity.create(WF_ONBOARDING, { phaseId: PHASE_ONBOARDING });
      if (created) {
        hailer!.ui.snackbar.open('Onboarding checklist created.', 'OK', 3000).catch(() => {});
        onRefresh?.();
        load();
      }
    } catch (err) {
      console.error('Create failed:', err);
      toast({ title: 'Error creating checklist', description: String(err), status: 'error', duration: 4000 });
    }
    setCreating(false);
  }

  function openEditor(row: OnboardingRow) {
    setEditing(row);
    const initial: Record<string, string> = {};
    CHECKLIST_ITEMS.forEach(item => { initial[item.key] = String(row[item.key] || 'No 🅾️'); });
    setForm(initial);
    setOtherITNeeds(row.otherITNeeds || '');
    onOpen();
  }

  async function saveChecklist() {
    if (!editing) return;
    setSaving(true);
    try {
      const fields: Record<string, string> = { [F_OTHER_IT]: otherITNeeds };
      CHECKLIST_ITEMS.forEach(item => { fields[item.fieldId] = form[item.key]; });
      await hailer!.activity.update([{ _id: editing.id, fields }], {});
      toast({ title: 'Checklist updated', status: 'success', duration: 2000 });
      onClose();
      load();
    } catch (err) {
      toast({ title: 'Error saving checklist', description: String(err), status: 'error', duration: 4000 });
    }
    setSaving(false);
  }

  const totalInProgress = rows.length;
  const fullyComplete = rows.filter(r => r.outstandingItems === 0).length;
  const totalOutstanding = rows.reduce((s, r) => s + (Number(r.outstandingItems) || 0), 0);

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;

  return (
    <Box>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="cyan.400">
          <Stat><StatLabel>Onboarding</StatLabel><StatNumber>{totalInProgress}</StatNumber><StatHelpText>Checklists on record</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Fully Complete</StatLabel><StatNumber>{fullyComplete}</StatNumber><StatHelpText>All items done</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="orange.400">
          <Stat><StatLabel>Items Outstanding</StatLabel><StatNumber color={totalOutstanding > 0 ? 'orange.500' : undefined}>{totalOutstanding}</StatNumber><StatHelpText>Across all checklists</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="blue.400">
          <Flex h="100%" align="center">
            <Button colorScheme="blue" size="sm" width="full" isLoading={creating} onClick={createChecklist}>
              + New Onboarding Checklist
            </Button>
          </Flex>
        </Box>
      </SimpleGrid>

      {rows.length === 0 ? (
        <Text color={mutedText}>No onboarding checklists yet. Click "+ New Onboarding Checklist" to start one.</Text>
      ) : (
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>New Hire</Th>
                <Th>Responsible</Th>
                <Th>Checklist</Th>
                <Th isNumeric>Outstanding</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map(r => (
                <Tr key={r.id} _hover={{ bg: rowHover }}>
                  <Td fontWeight="medium" cursor="pointer" onClick={() => hailer!.ui.activity.open(r.id)}>{r.personName}</Td>
                  <Td cursor="pointer" onClick={() => hailer!.ui.activity.open(r.id)}>{r.responsibleName}</Td>
                  <Td>
                    <Wrap spacing={1}>
                      {CHECKLIST_ITEMS.map(item => (
                        <Badge key={item.key} colorScheme={statusColor(r[item.key])} fontSize="9px" title={item.label}>
                          {item.label.split(' ')[0]}
                        </Badge>
                      ))}
                    </Wrap>
                  </Td>
                  <Td isNumeric>
                    {r.outstandingItems > 0
                      ? <Badge colorScheme="orange">{r.outstandingItems}</Badge>
                      : <Badge colorScheme="green">Done</Badge>}
                  </Td>
                  <Td>
                    <Button size="xs" colorScheme="blue" variant="outline" onClick={() => openEditor(r)}>Update</Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Update Checklist Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Update Onboarding Checklist — {editing?.personName}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3} align="stretch">
              {CHECKLIST_ITEMS.map(item => (
                <FormControl key={item.key} display="flex" alignItems="center" justifyContent="space-between">
                  <FormLabel fontSize="sm" mb={0} flex="1">{item.label}</FormLabel>
                  <Select size="sm" maxW="200px" value={form[item.key] || 'No 🅾️'}
                    onChange={e => setForm(p => ({ ...p, [item.key]: e.target.value }))}>
                    {OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </Select>
                </FormControl>
              ))}
              <FormControl>
                <FormLabel fontSize="sm">Other IT needs</FormLabel>
                <Textarea rows={2} value={otherITNeeds} onChange={e => setOtherITNeeds(e.target.value)}
                  placeholder="Additional IT equipment or software needed..." />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button colorScheme="blue" isLoading={saving} onClick={saveChecklist}>Save</Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
