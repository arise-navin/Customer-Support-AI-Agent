import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Orders } from './pages/Orders';
import { Refunds } from './pages/Refunds';
import { Tickets } from './pages/Tickets';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Agents } from './pages/Agents';
import { Chat } from './pages/Chat';
import { Activity } from './pages/Activity';
import { Settings } from './pages/Settings';
import { StandaloneTestLab } from './pages/StandaloneTestLab';
import { SignetSettings } from './pages/SignetSettings';
import { SignetGovernanceLab } from './pages/SignetGovernanceLab';
import { DLPDashboard } from './pages/DLPDashboard';
import { PolicyDecisions } from './pages/PolicyDecisions';
import { Approvals } from './pages/Approvals';
import { KillSwitchDashboard } from './pages/KillSwitchDashboard';
import { EvidenceExplorer } from './pages/EvidenceExplorer';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/refunds" element={<Refunds />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/standalone-test-lab" element={<StandaloneTestLab />} />
        <Route path="/signet-governance-lab" element={<SignetGovernanceLab />} />
        <Route path="/dlp-events" element={<DLPDashboard />} />
        <Route path="/policy-decisions" element={<PolicyDecisions />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/kill-switch" element={<KillSwitchDashboard />} />
        <Route path="/evidence-explorer" element={<EvidenceExplorer />} />
        <Route path="/signet-settings" element={<SignetSettings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
