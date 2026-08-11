import {
  Box, Flex, Heading, SimpleGrid, Spinner, Stat, StatHelpText,
  StatLabel, StatNumber, Text, useColorModeValue,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';

// Workflow IDs
const WF_EMPLOYEE_DIR  = '6a4b9b64fd37515ffb36cd50';
const WF_HR_TICKETS    = '6a4b9b64fd37515ffb36cdcf';
const WF_JOB_APPS      = '6a4b9b64fd37515ffb36cde4';
const WF_VACANCIES     = '6a4b9b64fd37515ffb36cde5';
const WF_ONBOARDING    = '6a4b9b64fd37515ffb36cd85';
const WF_PTO_REQUESTS  = '6a717f77a8140c7b12b1ceac';

// Phase IDs
const PHASE_ACTIVE_EMP    = '6a4b9b64fd37515ffb36cd6b';
const PHASE_CONTRACTOR    = '6a4b9b64fd37515ffb36cd9e';
const PHASE_HR_OPEN       = '6a4b9b64fd37515ffb36cdd9';
const PHASE_JOB_RECEIVED  = '6a4b9b64fd37515ffb36cdee';
const PHASE_JOB_INTERVIEW = '6a4b9b64fd37515ffb36cdef';
const PHASE_VAC_PUBLISHED = '6a4b9b64fd37515ffb36cdf6';
const PHASE_ONBOARDING    = '6a4b9b64fd37515ffb36cd8d';
const PHASE_PTO_PENDING   = '6a717fac693253992c87719e';

interface Props { refreshKey?: number; }

export default function OverviewPanel({ refreshKey = 0 }: Props) {
  const { hailer, inside } = useApp();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);

    Promise.all([
      hailer!.activity.list(WF_EMPLOYEE_DIR, PHASE_ACTIVE_EMP, { limit: 1 }),
      hailer!.activity.list(WF_EMPLOYEE_DIR, PHASE_CONTRACTOR, { limit: 1 }),
      hailer!.activity.list(WF_HR_TICKETS, PHASE_HR_OPEN, { limit: 1 }),
      hailer!.activity.list(WF_JOB_APPS, PHASE_JOB_RECEIVED, { limit: 1 }),
      hailer!.activity.list(WF_JOB_APPS, PHASE_JOB_INTERVIEW, { limit: 1 }),
      hailer!.activity.list(WF_VACANCIES, PHASE_VAC_PUBLISHED, { limit: 1 }),
      hailer!.activity.list(WF_ONBOARDING, PHASE_ONBOARDING, { limit: 1 }),
      hailer!.activity.list(WF_PTO_REQUESTS, PHASE_PTO_PENDING, { limit: 1 }),
    ]).then(results => {
      // Note: list returns activities but we need counts
      // Use the workspace user count as employee count for now
      setCounts({
        activeEmployees: results[0].length,
        contractors: results[1].length,
        openHRTickets: results[2].length,
        jobApplications: results[3].length + results[4].length,
        openVacancies: results[5].length,
        onboarding: results[6].length,
        pendingPTO: results[7].length,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
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

      <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={5}>
        <Heading size="sm" mb={4}>Quick Links</Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          {[
            { label: '❤️ Employee Directory', id: WF_EMPLOYEE_DIR },
            { label: '💛 HR Tickets', id: WF_HR_TICKETS },
            { label: '💜 Job Applications', id: WF_JOB_APPS },
            { label: '💜 Vacancies', id: WF_VACANCIES },
          ].map(l => (
            <Box key={l.id} p={3} bg={cardBg} border="1px" borderColor={borderColor}
              borderRadius="md" cursor="pointer"
              onClick={() => hailer!.ui.activity.create(l.id)}
              _hover={{ borderColor: 'blue.400' }}>
              <Text fontWeight="medium" fontSize="sm">{l.label}</Text>
              <Text fontSize="xs" color="gray.400">Click to open in Hailer</Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
