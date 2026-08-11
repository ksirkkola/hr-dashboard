import { useEffect } from 'react';
import {
  Box, Button, Flex, Heading, Spinner, Tab, TabList, TabPanel,
  TabPanels, Tabs, Text, useColorMode, useColorModeValue,
} from '@chakra-ui/react';
import { useApp } from './hailer/use-app';
import { useRefresh } from './hailer/use-refresh';
import OverviewPanel from './components/OverviewPanel';
import PTOPanel from './components/PTOPanel';
import BonusPanel from './components/BonusPanel';

export default function App() {
  const { api, inside, ready, settings } = useApp();
  const { setColorMode } = useColorMode();
  const { refreshKey, refresh, fmtLastUpdated } = useRefresh();

  const bg          = useColorModeValue('gray.50', 'gray.900');
  const headerBg    = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const mutedText   = useColorModeValue('gray.400', 'gray.500');

  useEffect(() => { void api.init(); }, [api]);

  useEffect(() => {
    if (settings?.theme === 'dark') setColorMode('dark');
    else if (settings?.theme) setColorMode('light');
  }, [settings, setColorMode]);

  if (!inside) return (
    <Flex h="100vh" align="center" justify="center">
      <Text color="gray.500">Open this app inside Hailer</Text>
    </Flex>
  );

  if (!ready) return (
    <Flex h="100vh" align="center" justify="center">
      <Spinner size="xl" />
    </Flex>
  );

  return (
    <Box minH="100vh" bg={bg}>
      <Box bg={headerBg} px={6} py={4} borderBottom="1px" borderColor={borderColor} mb={4}>
        <Flex align="center" justify="space-between">
          <Heading size="md">HR Dashboard</Heading>
          <Flex align="center" gap={3}>
            <Text fontSize="xs" color={mutedText}>Updated {fmtLastUpdated()}</Text>
            <Button size="sm" variant="outline" onClick={refresh}>↻ Refresh</Button>
          </Flex>
        </Flex>
      </Box>

      <Box px={6} pb={8}>
        <Tabs variant="enclosed" colorScheme="blue">
          <TabList mb={4}>
            <Tab fontWeight="semibold">Overview</Tab>
            <Tab fontWeight="semibold">PTO</Tab>
            <Tab fontWeight="semibold">Bonuses</Tab>
          </TabList>

          <TabPanels>
            <TabPanel px={0}><OverviewPanel refreshKey={refreshKey} /></TabPanel>
            <TabPanel px={0}><PTOPanel refreshKey={refreshKey} /></TabPanel>
            <TabPanel px={0}><BonusPanel refreshKey={refreshKey} /></TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Box>
  );
}
