import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Flex, Input, SimpleGrid, Spinner, Text, VStack, useColorModeValue,
} from '@chakra-ui/react';
import { useApp } from '../hailer/use-app';
import { formatDate, formatNextAnniversary, formatTenure } from '../tenure';

const INSIGHT_ALL_EMPLOYEES = '6ac32cf115b5a228afcd672d';

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
  emergencyContact: string | null;
  benefits: string | null;
  status: string | null;
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  return (
    <Box>
      <Text fontSize="xs" color={mutedText}>{label}</Text>
      <Text fontSize="sm" fontWeight="medium">{value || '—'}</Text>
    </Box>
  );
}

interface Props { refreshKey?: number }

export default function EmployeeDirectoryPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside } = useApp();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const hoverBg = useColorModeValue('gray.50', 'gray.600');

  useEffect(() => {
    if (!inside || !hailer) return;
    setLoading(true);
    hailer.insight.data(INSIGHT_ALL_EMPLOYEES, { update: true }).then(data => {
      const rows = parseInsight(data).map(r => ({
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
        emergencyContact: (r.emergencyContact as string) || null,
        benefits: (r.benefits as string) || null,
        status: (r.status as string) || null,
      })) as EmployeeRow[];
      setEmployees(rows);
      setSelectedId(prev => prev && rows.some(r => r.id === prev) ? prev : (rows[0]?.id ?? null));
      setLoading(false);
    }).catch(err => { setError(String(err)); setLoading(false); });
  }, [inside, hailer, refreshKey]);

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
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={selected.benefits ? 4 : 0}>
              <Field label="Work Email" value={selected.workEmail} />
              <Field label="Work Phone" value={selected.workPhone} />
              {selected.emergencyContact && <Field label="Emergency Contact (ICE)" value={selected.emergencyContact} />}
            </SimpleGrid>
            {selected.benefits && (
              <Box>
                <Text fontSize="xs" color={mutedText}>Benefits</Text>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="pre-wrap">{selected.benefits}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Flex>
  );
}
