import {
  Badge, Box, Button, Flex, FormControl, FormLabel, HStack, Input,
  Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  Select, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, Textarea,
  useColorModeValue, useDisclosure, useToast,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_COMPANY_DOCS = '6aa3a9883a6ad1770e6a85e0';
const INSIGHT_EMPLOYEE_DOCS = '6aa3a9883a6ad1770e6a85e5';

const WF_COMPANY_DOCS = '6aa3a896ad81c8612fcec24f';
const WF_EMPLOYEE_DOCS = '6aa3a897ad81c8612fcec25d';
const PHASE_COMPANY_DOCS_ACTIVE = '6aa3a896ad81c8612fcec24e';
const PHASE_EMPLOYEE_DOCS_ACTIVE = '6aa3a897ad81c8612fcec25c';

const CD_CATEGORY = '6aa3a8c9122c5d66bc404aaf';
const CD_FILE = '6aa3a8c9122c5d66bc404ab2';
const CD_DESCRIPTION = '6aa3a8c9122c5d66bc404ab6';

const ED_EMPLOYEE = '6aa3a8c9122c5d66bc404aba';
const ED_CATEGORY = '6aa3a8c9122c5d66bc404abf';
const ED_FILE = '6aa3a8c9122c5d66bc404ac2';
const ED_DESCRIPTION = '6aa3a8c9122c5d66bc404ac5';

const GENERAL_CATEGORIES = ['Employee Handbook', 'Insurance', 'Benefits', 'Policies & Manuals', 'Other'];
const EMPLOYEE_CATEGORIES = ['Contract', 'Employee Handbook', 'Insurance', 'Benefits', 'Policies & Manuals', 'Other'];
const GENERAL_LABEL = 'GENERAL / COMPANY-WIDE';

interface DocRow {
  id: string;
  employeeId: string | null; // null = company-wide
  category: string | null;
  description: string | null;
  file: string | null; // raw JSON-array-string from the field, or null
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

function firstFileId(raw: unknown): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed[0];
  } catch {
    if (typeof raw === 'string') return raw;
  }
  return undefined;
}

interface Props { refreshKey?: number; onRefresh?: () => void }

export default function DocumentsPanel({ refreshKey = 0, onRefresh }: Props) {
  const { hailer, inside, user } = useApp();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [form, setForm] = useState({ employeeId: '', category: GENERAL_CATEGORIES[0], description: '' });

  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg = useColorModeValue('gray.50', 'gray.800');
  const mutedText = useColorModeValue('gray.500', 'gray.400');

  function load() {
    if (!inside) return;
    setLoading(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_COMPANY_DOCS, { update: true }),
      hailer!.insight.data(INSIGHT_EMPLOYEE_DOCS, { update: true }),
    ]).then(([company, employee]) => {
      const companyRows: DocRow[] = parseInsight(company).map(r => ({
        id: r.id as string,
        employeeId: null,
        category: (r.category as string) || null,
        description: (r.description as string) || null,
        file: (r.file as string) || null,
      }));
      const employeeRows: DocRow[] = parseInsight(employee).map(r => ({
        id: r.id as string,
        employeeId: (r.employee as string) || null,
        category: (r.category as string) || null,
        description: (r.description as string) || null,
        file: (r.file as string) || null,
      }));
      setRows([...employeeRows, ...companyRows]);
      setLoading(false);
    }).catch(err => { console.error(err); setLoading(false); });
  }

  useEffect(load, [inside, refreshKey]);

  function employeeName(id: string | null): string {
    if (!id) return GENERAL_LABEL;
    const u = user.map[id];
    return u ? `${u.firstname} ${u.lastname}` : id;
  }

  const allEmployeesSorted = useMemo(
    () => Object.values(user.map).sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)),
    [user.map],
  );

  const filteredRows = useMemo(
    () => employeeFilter ? rows.filter(r => r.employeeId === employeeFilter) : rows,
    [rows, employeeFilter],
  );

  function handleFileSelected(file: File | null) {
    setUploadFile(file);
  }

  async function submitUpload() {
    if (!uploadFile && !form.description.trim()) {
      toast({ title: 'Add a file or a description before saving', status: 'warning', duration: 3000 });
      return;
    }
    setSubmitting(true);
    try {
      let fileId: string | undefined;
      if (uploadFile) {
        fileId = await hailer!.file.upload(uploadFile, uploadFile.name, {});
      }
      const isEmployeeDoc = !!form.employeeId;
      if (isEmployeeDoc) {
        const fields: Record<string, string> = {
          [ED_EMPLOYEE]: form.employeeId,
          [ED_CATEGORY]: form.category,
        };
        if (form.description.trim()) fields[ED_DESCRIPTION] = form.description.trim();
        if (fileId) fields[ED_FILE] = JSON.stringify([fileId]);
        await hailer!.activity.create(WF_EMPLOYEE_DOCS, [{
          name: `${employeeName(form.employeeId)} — ${form.category}`,
          phaseId: PHASE_EMPLOYEE_DOCS_ACTIVE,
          fields,
        }], {});
      } else {
        const fields: Record<string, string> = {
          [CD_CATEGORY]: form.category,
        };
        if (form.description.trim()) fields[CD_DESCRIPTION] = form.description.trim();
        if (fileId) fields[CD_FILE] = JSON.stringify([fileId]);
        await hailer!.activity.create(WF_COMPANY_DOCS, [{
          name: `${form.category} (General)`,
          phaseId: PHASE_COMPANY_DOCS_ACTIVE,
          fields,
        }], {});
      }
      toast({ title: 'Document saved', status: 'success', duration: 2500 });
      onClose();
      setForm({ employeeId: '', category: GENERAL_CATEGORIES[0], description: '' });
      setUploadFile(null);
      onRefresh?.();
      load();
    } catch (err) {
      toast({ title: 'Error saving document', description: String(err), status: 'error', duration: 4000 });
    }
    setSubmitting(false);
  }

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;

  return (
    <Box>
      <Text color={mutedText} fontSize="sm" mb={4}>
        Contracts, insurance documents, and general reference files. Employee-specific documents
        become visible to that employee under "My Documents"; general reference documents (no
        employee attached) show up for everyone under "Company Documents" — both in the 🌴 My
        Employment Info app.
      </Text>

      <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={3}>
        <HStack spacing={3}>
          <Select maxW="260px" placeholder="Filter by employee..." value={employeeFilter}
            onChange={e => setEmployeeFilter(e.target.value)}>
            {allEmployeesSorted.map(u => (
              <option key={u._id} value={u._id}>{u.firstname} {u.lastname}</option>
            ))}
          </Select>
          <Text fontSize="sm" color={mutedText}>{filteredRows.length} document{filteredRows.length === 1 ? '' : 's'}</Text>
        </HStack>
        <Button colorScheme="blue" size="sm" onClick={onOpen}>+ Upload Document</Button>
      </Flex>

      {filteredRows.length === 0 ? (
        <Text color={mutedText}>No documents on file yet.</Text>
      ) : (
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Employee</Th>
                <Th>Category</Th>
                <Th>Description</Th>
                <Th>File</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredRows.map(r => {
                const fileId = firstFileId(r.file);
                return (
                  <Tr key={r.id} cursor="pointer" onClick={() => hailer!.ui.activity.open(r.id)}>
                    <Td>
                      {r.employeeId
                        ? <Text fontWeight="medium">{employeeName(r.employeeId)}</Text>
                        : <Badge colorScheme="cyan">{GENERAL_LABEL}</Badge>}
                    </Td>
                    <Td><Badge colorScheme={r.employeeId ? 'purple' : 'gray'}>{(r.category || '').toUpperCase()}</Badge></Td>
                    <Td fontSize="sm">{r.description || '—'}</Td>
                    <Td>
                      {fileId ? (
                        <Button
                          as="a" href={`https://api.hailer.com/file/${fileId}`} target="_blank" rel="noreferrer"
                          size="xs" variant="outline" onClick={e => e.stopPropagation()}
                        >
                          Download
                        </Button>
                      ) : '—'}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      )}

      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upload Document</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">Employee</FormLabel>
              <Select placeholder={GENERAL_LABEL} value={form.employeeId}
                onChange={e => {
                  const employeeId = e.target.value;
                  setForm(p => ({
                    ...p, employeeId,
                    category: employeeId ? EMPLOYEE_CATEGORIES[0] : GENERAL_CATEGORIES[0],
                  }));
                }}>
                {allEmployeesSorted.map(u => (
                  <option key={u._id} value={u._id}>{u.firstname} {u.lastname}</option>
                ))}
              </Select>
              <Text fontSize="xs" color={mutedText} mt={1}>
                Leave as "{GENERAL_LABEL}" for a company-wide reference document.
              </Text>
            </FormControl>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">Category</FormLabel>
              <Select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {(form.employeeId ? EMPLOYEE_CATEGORIES : GENERAL_CATEGORIES).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </FormControl>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">Description</FormLabel>
              <Textarea rows={3} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="What is this document?" />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">File</FormLabel>
              <Input type="file" accept="application/pdf,image/*" p={1}
                onChange={e => handleFileSelected(e.target.files?.[0] || null)} />
              {uploadFile && <Text fontSize="xs" color={mutedText} mt={1}>Selected: {uploadFile.name}</Text>}
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="blue" isLoading={submitting} onClick={submitUpload}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
