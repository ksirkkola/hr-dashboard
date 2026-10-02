import {
  Badge, Box, Flex, Heading, SimpleGrid, Spinner, Stat, StatHelpText,
  StatLabel, StatNumber, Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';

// Workflow IDs (used by the Quick Create shortcuts below)
const WF_EMPLOYEE_DIR  = '6a4b9b64fd37515ffb36cd50';
const WF_HR_TICKETS    = '6a4b9b64fd37515ffb36cdcf';
const WF_JOB_APPS      = '6a4b9b64fd37515ffb36cde4';
const WF_VACANCIES     = '6a4b9b64fd37515ffb36cde5';

// Phase IDs
const PHASE_ACTIVE_EMP    = '6a4b9b64fd37515ffb36cd6b';
const PHASE_CONTRACTOR    = '6a4b9b64fd37515ffb36cd9e';
const PHASE_HR_OPEN       = '6a4b9b64fd37515ffb36cdd9';
const PHASE_JOB_RECEIVED  = '6a4b9b64fd37515ffb36cdee';
const PHASE_JOB_INTERVIEW = '6a4b9b64fd37515ffb36cdef';
const PHASE_VAC_PUBLISHED = '6a4b9b64fd37515ffb36cdf6';

// Saved insights — real counts over the FULL dataset, not a truncated activity.list().
// (activity.list has no count mode; a { limit: 1 } call only ever returns 0 or 1 item.)
const INSIGHT_OVERVIEW_COUNTS = '6a9aae00ce50752c3e8990f7'; // employee/ticket/jobapp/vacancy/onboarding phaseIds
const INSIGHT_PTO_REQUESTS = '6a7180504af977ffe55b40f6'; // same insight PTOPanel uses; excludes Cancelled
const INSIGHT_EMPLOYEE_DIRECTORY = '6a9aafbda51ebb56d30d4896';
const INSIGHT_DISCIPLINARY = '6a9aafbda51ebb56d30d4898';
const INSIGHT_EXIT_CHECKLIST = '6a9aafbda51ebb56d30d489a';
const INSIGHT_JOB_FUNNEL = '6a9aafbda51ebb56d30d489c';
const INSIGHT_ONBOARDING_STATUS = '6a9ab2b32913b623acec9b5f';

const PROBATION_WINDOW_MS = { past: 7 * 24 * 60 * 60 * 1000, future: 14 * 24 * 60 * 60 * 1000 };

function fmtDate(sec: number | null): string {
  if (!sec) return '—';
  return new Date(sec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface ProbationRow { name: string; endDate: number; overdue: boolean }
interface AnniversaryRow { name: string; nextAnniversary: number; years: number }
interface DisciplinaryRow { employeeName: string; severity: string; dateVal: number | null }
interface ExitRow { employeeName: string; unresolvedItems: number }
interface OnboardingRow { employeeName: string; outstandingItems: number }
interface FunnelRow { vacancyName: string; received: number; interview: number }

interface Props { refreshKey?: number; onRefresh?: () => void; }

export default function OverviewPanel({ refreshKey = 0, onRefresh }: Props) {
  const { hailer, inside } = useApp();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [probations, setProbations] = useState<ProbationRow[]>([]);
  const [anniversaries, setAnniversaries] = useState<AnniversaryRow[]>([]);
  const [disciplinary, setDisciplinary] = useState<DisciplinaryRow[]>([]);
  const [exitChecklists, setExitChecklists] = useState<ExitRow[]>([]);
  const [onboardingIncomplete, setOnboardingIncomplete] = useState<OnboardingRow[]>([]);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText   = useColorModeValue('gray.500', 'gray.400');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);

    Promise.all([
      hailer!.insight.data(INSIGHT_OVERVIEW_COUNTS, { update: true }),
      hailer!.insight.data(INSIGHT_PTO_REQUESTS, { update: true }),
      hailer!.insight.data(INSIGHT_EMPLOYEE_DIRECTORY, { update: true }),
      hailer!.insight.data(INSIGHT_DISCIPLINARY, { update: true }),
      hailer!.insight.data(INSIGHT_EXIT_CHECKLIST, { update: true }),
      hailer!.insight.data(INSIGHT_JOB_FUNNEL, { update: true }),
      hailer!.insight.data(INSIGHT_ONBOARDING_STATUS, { update: true }),
    ]).then(([overview, pto, emp, disc, exitC, jobFunnel, onboardingStatus]) => {
      const oh = overview.headers;
      const sourceIdx = oh.indexOf('source');
      const phaseIdx = oh.indexOf('phaseId');
      const tally: Record<string, number> = {};
      overview.rows.forEach(row => {
        const key = `${row[sourceIdx]}:${row[phaseIdx]}`;
        tally[key] = (tally[key] || 0) + 1;
      });

      const ph = pto.headers;
      const ptoPhaseIdx = ph.indexOf('phase');
      const pendingPTO = pto.rows.filter(row => row[ptoPhaseIdx] === 'Pending').length;

      setCounts({
        activeEmployees: tally[`employee:${PHASE_ACTIVE_EMP}`] || 0,
        contractors: tally[`employee:${PHASE_CONTRACTOR}`] || 0,
        openHRTickets: tally[`ticket:${PHASE_HR_OPEN}`] || 0,
        jobApplications: (tally[`jobapp:${PHASE_JOB_RECEIVED}`] || 0) + (tally[`jobapp:${PHASE_JOB_INTERVIEW}`] || 0),
        openVacancies: tally[`vacancy:${PHASE_VAC_PUBLISHED}`] || 0,
        // Onboarding Checklists is an unlinked dataset — every record counts as "in progress".
        onboarding: Object.keys(tally).filter(k => k.startsWith('onboarding:')).reduce((s, k) => s + tally[k], 0),
        pendingPTO,
      });

      // Probations ending soon — window covers a week back (in case nobody
      // followed up yet) through two weeks ahead. Active/Contractor phases only.
      const eh = emp.headers;
      const nameIdx = eh.indexOf('name');
      const probIdx = eh.indexOf('probationEndDate');
      const empPhaseIdx = eh.indexOf('phaseId');
      const now = Date.now();
      const probRows: ProbationRow[] = [];
      emp.rows.forEach(row => {
        const phaseId = row[empPhaseIdx];
        if (phaseId !== PHASE_ACTIVE_EMP && phaseId !== PHASE_CONTRACTOR) return;
        const endSec = Number(row[probIdx]);
        if (!endSec) return;
        const endMs = endSec * 1000;
        if (endMs < now - PROBATION_WINDOW_MS.past || endMs > now + PROBATION_WINDOW_MS.future) return;
        probRows.push({ name: String(row[nameIdx] || 'Unknown'), endDate: endSec, overdue: endMs < now });
      });
      probRows.sort((a, b) => a.endDate - b.endDate);
      setProbations(probRows);

      // Upcoming work anniversaries — next occurrence of the starting date's month/day,
      // within the next 30 days. Active/Contractor phases only.
      const startIdx = eh.indexOf('startingDate');
      const annRows: AnniversaryRow[] = [];
      emp.rows.forEach(row => {
        const phaseId = row[empPhaseIdx];
        if (phaseId !== PHASE_ACTIVE_EMP && phaseId !== PHASE_CONTRACTOR) return;
        const startSec = Number(row[startIdx]);
        if (!startSec) return;
        const start = new Date(startSec * 1000);
        const today = new Date(now);
        let next = new Date(Date.UTC(today.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
        if (next.getTime() < now) next = new Date(Date.UTC(today.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate()));
        const daysOut = (next.getTime() - now) / (24 * 60 * 60 * 1000);
        if (daysOut > 30) return;
        const years = next.getUTCFullYear() - start.getUTCFullYear();
        annRows.push({ name: String(row[nameIdx] || 'Unknown'), nextAnniversary: next.getTime() / 1000, years });
      });
      annRows.sort((a, b) => a.nextAnniversary - b.nextAnniversary);
      setAnniversaries(annRows);

      // Disciplinary Actions — most recent first, capped to a reasonable list.
      const dh = disc.headers;
      const dNameIdx = dh.indexOf('employeeName');
      const dSevIdx = dh.indexOf('severity');
      const dDateIdx = dh.indexOf('dateVal');
      const discRows: DisciplinaryRow[] = disc.rows.map(row => ({
        employeeName: String(row[dNameIdx] || 'Unknown'),
        severity: String(row[dSevIdx] || ''),
        dateVal: row[dDateIdx] ? Number(row[dDateIdx]) : null,
      })).sort((a, b) => (b.dateVal || 0) - (a.dateVal || 0)).slice(0, 8);
      setDisciplinary(discRows);

      // Exit Checklists with unresolved items (insight already filters to > 0).
      const xh = exitC.headers;
      const xNameIdx = xh.indexOf('employeeName');
      const xUnresolvedIdx = xh.indexOf('unresolvedItems');
      setExitChecklists(exitC.rows.map(row => ({
        employeeName: String(row[xNameIdx] || 'Unknown'),
        unresolvedItems: Number(row[xUnresolvedIdx]) || 0,
      })));

      // Onboarding checklists with outstanding items (insight already filters to > 0).
      const onh = onboardingStatus.headers;
      const onNameIdx = onh.indexOf('employeeName');
      const onOutstandingIdx = onh.indexOf('outstandingItems');
      setOnboardingIncomplete(onboardingStatus.rows.map(row => ({
        employeeName: String(row[onNameIdx] || 'Unknown'),
        outstandingItems: Number(row[onOutstandingIdx]) || 0,
      })));

      // Job Applications funnel, grouped by vacancy.
      const jh = jobFunnel.headers;
      const jVacIdx = jh.indexOf('vacancyName');
      const jPhaseIdx = jh.indexOf('phaseId');
      const funnelMap: Record<string, FunnelRow> = {};
      jobFunnel.rows.forEach(row => {
        const vac = String(row[jVacIdx] || 'Unspecified');
        if (!funnelMap[vac]) funnelMap[vac] = { vacancyName: vac, received: 0, interview: 0 };
        if (row[jPhaseIdx] === PHASE_JOB_RECEIVED) funnelMap[vac].received++;
        else if (row[jPhaseIdx] === PHASE_JOB_INTERVIEW) funnelMap[vac].interview++;
      });
      setFunnel(Object.values(funnelMap).sort((a, b) => (b.received + b.interview) - (a.received + a.interview)));

      setLoading(false);
    }).catch(err => {
      console.error('Failed to load Overview counts:', err);
      setLoading(false);
    });
  }, [inside, refreshKey]);

  if (loading) return <Flex justify="center" align="center" h="200px"><Spinner size="xl" /></Flex>;

  const cards = [
    { label: 'Active Employees', value: counts.activeEmployees || 0, color: 'blue.400', help: 'Full time' },
    { label: 'Contractors', value: counts.contractors || 0, color: 'purple.400', help: 'Active' },
    { label: 'Open Vacancies', value: counts.openVacancies || 0, color: 'orange.400', help: 'Hiring' },
    { label: 'Job Applications', value: counts.jobApplications || 0, color: 'teal.400', help: 'Active' },
    { label: 'Onboarding', value: counts.onboarding || 0, color: 'cyan.400', help: 'In progress' },
    { label: 'Open HR Tickets', value: counts.openHRTickets || 0, color: 'red.400', help: 'Needs attention' },
    { label: 'Pending PTO', value: counts.pendingPTO || 0, color: 'yellow.400', help: 'Awaiting approval' },
  ];

  return (
    <Box>
      <SimpleGrid columns={{ base: 2, md: 4, lg: 7 }} spacing={4} mb={8}>
        {cards.map(c => (
          <Box key={c.label} p={4} bg={cardBg} borderRadius="md" shadow="sm"
            border="1px" borderColor={borderColor}
            borderTop="3px solid" borderTopColor={c.color}>
            <Stat>
              <StatLabel fontSize="xs" noOfLines={2}>{c.label}</StatLabel>
              <StatNumber>{c.value}</StatNumber>
              <StatHelpText fontSize="xs">{c.help}</StatHelpText>
            </Stat>
          </Box>
        ))}
      </SimpleGrid>

      <Heading size="sm" mb={3} color="gray.500" textTransform="uppercase" letterSpacing="wide">Needs Attention</Heading>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={4} mb={8}>
        <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4}>
          <Heading size="xs" mb={3}>Probations Ending Soon</Heading>
          {probations.length === 0 ? (
            <Text fontSize="sm" color={mutedText}>None in the next 14 days.</Text>
          ) : (
            <Table variant="simple" size="sm">
              <Tbody>
                {probations.map((p, i) => (
                  <Tr key={i}>
                    <Td fontSize="sm">{p.name}</Td>
                    <Td fontSize="sm" isNumeric>
                      {fmtDate(p.endDate)}{p.overdue && <Badge ml={2} colorScheme="red">Overdue</Badge>}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>

        <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4}>
          <Heading size="xs" mb={3}>🎉 Upcoming Anniversaries</Heading>
          {anniversaries.length === 0 ? (
            <Text fontSize="sm" color={mutedText}>None in the next 30 days.</Text>
          ) : (
            <Table variant="simple" size="sm">
              <Tbody>
                {anniversaries.map((a, i) => (
                  <Tr key={i}>
                    <Td fontSize="sm">{a.name}</Td>
                    <Td fontSize="sm" isNumeric>
                      {fmtDate(a.nextAnniversary)}
                      <Badge ml={2} colorScheme="cyan">{a.years} yr{a.years === 1 ? '' : 's'}</Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>

        <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4}>
          <Heading size="xs" mb={3}>Recent Disciplinary Actions</Heading>
          {disciplinary.length === 0 ? (
            <Text fontSize="sm" color={mutedText}>None on record.</Text>
          ) : (
            <Table variant="simple" size="sm">
              <Tbody>
                {disciplinary.map((d, i) => (
                  <Tr key={i}>
                    <Td fontSize="sm">{d.employeeName}</Td>
                    <Td fontSize="sm">
                      <Badge colorScheme={d.severity.toLowerCase().startsWith('written') || d.severity.toLowerCase().startsWith('kirjall') ? 'red' : 'orange'}>
                        {d.severity || '—'}
                      </Badge>
                    </Td>
                    <Td fontSize="sm" isNumeric>{fmtDate(d.dateVal)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>

        <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4}>
          <Heading size="xs" mb={3}>Exit Checklists Incomplete</Heading>
          {exitChecklists.length === 0 ? (
            <Text fontSize="sm" color={mutedText}>All exit checklists are complete.</Text>
          ) : (
            <Table variant="simple" size="sm">
              <Tbody>
                {exitChecklists.map((x, i) => (
                  <Tr key={i}>
                    <Td fontSize="sm">{x.employeeName}</Td>
                    <Td fontSize="sm" isNumeric>
                      <Badge colorScheme="red">{x.unresolvedItems} unresolved</Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>

        <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4}>
          <Heading size="xs" mb={3}>Onboarding Incomplete</Heading>
          {onboardingIncomplete.length === 0 ? (
            <Text fontSize="sm" color={mutedText}>No onboarding checklists have outstanding items.</Text>
          ) : (
            <Table variant="simple" size="sm">
              <Tbody>
                {onboardingIncomplete.map((o, i) => (
                  <Tr key={i}>
                    <Td fontSize="sm">{o.employeeName}</Td>
                    <Td fontSize="sm" isNumeric>
                      <Badge colorScheme="orange">{o.outstandingItems} outstanding</Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>
      </SimpleGrid>

      {funnel.length > 0 && (
        <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={5} mb={8}>
          <Heading size="sm" mb={4}>Hiring Funnel by Vacancy</Heading>
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Vacancy</Th>
                <Th isNumeric>Received</Th>
                <Th isNumeric>Interviewing</Th>
                <Th isNumeric>Total</Th>
              </Tr>
            </Thead>
            <Tbody>
              {funnel.map((f, i) => (
                <Tr key={i}>
                  <Td fontSize="sm" fontWeight="medium">{f.vacancyName}</Td>
                  <Td isNumeric fontSize="sm">{f.received}</Td>
                  <Td isNumeric fontSize="sm">{f.interview}</Td>
                  <Td isNumeric fontSize="sm" fontWeight="bold">{f.received + f.interview}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={5}>
        <Heading size="sm" mb={1}>Quick Create</Heading>
        <Text fontSize="xs" color="gray.400" mb={4}>
          The app can't jump to a workflow's list view in Hailer — only open one activity or create a new
          one. These shortcuts create a new record; to browse existing ones, open the workflow in Hailer directly.
        </Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          {[
            { label: '❤️ New Employee', id: WF_EMPLOYEE_DIR, phaseId: PHASE_ACTIVE_EMP },
            { label: '💛 New HR Ticket', id: WF_HR_TICKETS, phaseId: PHASE_HR_OPEN },
            { label: '💜 New Job Application', id: WF_JOB_APPS, phaseId: PHASE_JOB_RECEIVED },
            { label: '💜 New Vacancy', id: WF_VACANCIES, phaseId: PHASE_VAC_PUBLISHED },
          ].map(l => (
            <Box key={l.id} p={3} bg={cardBg} border="1px" borderColor={borderColor}
              borderRadius="md" cursor="pointer"
              opacity={creating === l.id ? 0.6 : 1}
              pointerEvents={creating ? 'none' : 'auto'}
              onClick={async () => {
                setCreating(l.id);
                try {
                  const created = await hailer!.ui.activity.create(l.id, { phaseId: l.phaseId });
                  if (created) {
                    hailer!.ui.snackbar.open(`${l.label.replace(/^\S+\s/, '')} created.`, 'OK', 3000).catch(() => {});
                    onRefresh?.();
                  }
                } catch (err) {
                  console.error('Create failed:', err);
                  hailer!.ui.snackbar.open("We couldn't create that. Please try again.", 'OK', 4000).catch(() => {});
                } finally {
                  setCreating(null);
                }
              }}
              _hover={{ borderColor: 'blue.400' }}>
              <Text fontWeight="medium" fontSize="sm">{l.label}</Text>
              <Text fontSize="xs" color="gray.400">Creates a new record</Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
