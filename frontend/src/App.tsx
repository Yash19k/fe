import React, { useState, useEffect } from 'react';
import { AppProvider } from './state/AppContext';
import { useApp } from './hooks/useApp';
import { GlobalRail } from './components/navigation/GlobalRail';
import { WorkspaceSidebar } from './components/navigation/WorkspaceSidebar';
import { Topbar } from './components/navigation/Topbar';
import { ProjectHeader } from './components/navigation/ProjectHeader';
import { TaskDetailsDrawer } from './components/tasks/TaskDetailsDrawer';
import { CreateTaskModal } from './components/tasks/CreateTaskModal';
import { CreateSprintModal } from './components/sprints/CreateSprintModal';
import { CreateProjectModal } from './components/modals/CreateProjectModal';
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { ImpactPreviewModal } from './components/modals/ImpactPreviewModal';
import { ConflictModal } from './components/modals/ConflictModal';
import { ToastContainer } from './components/ui/ToastContainer';
import { Lock } from 'lucide-react';
import { canUserAccessProject } from './domain/permissions';

// Feature Views
import { HomeView } from './features/home/HomeView';
import { MyTasksView } from './features/my-tasks/MyTasksView';
import { ProjectsView } from './features/projects/ProjectsView';
import { ProjectOverviewView } from './features/project/ProjectOverviewView';
import { ProjectListView } from './features/project/ProjectListView';
import { ProjectBoardView } from './features/project/ProjectBoardView';
import { ProjectTimelineView } from './features/project/ProjectTimelineView';
import { ProjectCalendarView } from './features/project/ProjectCalendarView';
import { ProjectDashboardView } from './features/project/ProjectDashboardView';
import { WorkflowBuilderView } from './features/project/WorkflowBuilderView';
import { DependenciesView } from './features/project/DependenciesView';
import { ProjectSettingsView } from './features/project/ProjectSettingsView';
import { SettingsView } from './features/settings/SettingsView';
import { AuthView } from './features/auth/AuthView';
import { CompanySetupView } from './features/onboarding/CompanySetupView';

function MainAppShell() {
  const { activeRoute, projectTab, currentUser, currentProject, currentWorkflow, navigate } = useApp();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [createTaskInitialDate, setCreateTaskInitialDate] = useState<string | undefined>();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Global keydown: Cmd+K / Ctrl+K for search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auth views
  if (activeRoute === '/login') {
    return <AuthView isSignup={false} />;
  }
  if (activeRoute === '/signup') {
    return <AuthView isSignup={true} />;
  }

  // Dedicated Company Setup & Onboarding Guard:
  // Render CompanySetupView if the user has not completed onboarding,
  // or is explicitly on the /onboarding/company route and has not completed setup.
  const needsOnboarding = Boolean(currentUser && currentUser.onboardingCompleted === false);
  if (needsOnboarding || (activeRoute === '/onboarding/company' && !currentUser?.onboardingCompleted)) {
    return <CompanySetupView />;
  }

  const isProjectRoute = activeRoute.startsWith('/project/');
  const hasProjectAccess = currentProject ? canUserAccessProject(currentProject, currentUser.id) : true;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-text-primary antialiased">
      {/* 1. Global Navigation Rail */}
      <GlobalRail />

      {/* 2. Workspace Sidebar */}
      <WorkspaceSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenCreateProject={() => setCreateProjectOpen(true)}
      />

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar
          onToggleSidebar={() => setSidebarOpen(true)}
          onOpenCreateTask={() => setCreateTaskOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        {/* Persistent Project Header if in project context and accessible */}
        {isProjectRoute && currentProject && hasProjectAccess && (
          <ProjectHeader
            onOpenCreateTask={() => setCreateTaskOpen(true)}
            onOpenCreateSprint={() => setCreateSprintOpen(true)}
          />
        )}

        {/* Main View Router */}
        <main className="flex-1 overflow-y-auto">
          {isProjectRoute ? (
            !currentProject ? (
              <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-canvas">
                <h2 className="text-base font-semibold text-text-primary mb-1">
                  Project Not Found
                </h2>
                <p className="text-xs text-text-muted max-w-sm mb-5">
                  The requested project does not exist or has been removed.
                </p>
                <button
                  onClick={() => navigate('/projects')}
                  className="px-3.5 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-text-primary hover:bg-surface-hover hover:border-border-strong transition-colors"
                >
                  Back to Projects
                </button>
              </div>
            ) : !hasProjectAccess ? (
              <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-canvas">
                <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-muted mb-4 shadow-xs">
                  <Lock size={20} className="text-amber-400" />
                </div>
                <h2 className="text-base font-semibold text-text-primary mb-1">
                  You don&apos;t have access to this project
                </h2>
                <p className="text-xs text-text-muted max-w-sm mb-5 leading-relaxed">
                  This project is private and only visible to the project owner and explicitly added members.
                </p>
                <button
                  onClick={() => navigate('/projects')}
                  className="px-3.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs font-medium text-text-primary hover:bg-surface-hover hover:border-border-strong transition-colors"
                >
                  Back to Accessible Projects
                </button>
              </div>
            ) : (
              <>
                {projectTab === 'overview' && <ProjectOverviewView />}
                {projectTab === 'list' && (
                  <ProjectListView onOpenCreateTask={() => setCreateTaskOpen(true)} />
                )}
                {projectTab === 'board' && (
                  <ProjectBoardView onOpenCreateTask={() => setCreateTaskOpen(true)} />
                )}
                {projectTab === 'timeline' && <ProjectTimelineView />}
                {projectTab === 'calendar' && (
                  <ProjectCalendarView
                    onOpenCreateTask={(dateStr?: string) => {
                      setCreateTaskInitialDate(dateStr);
                      setCreateTaskOpen(true);
                    }}
                  />
                )}
                {projectTab === 'dashboard' && <ProjectDashboardView />}
                {projectTab === 'workflow' && <WorkflowBuilderView key={currentWorkflow?.id} />}
                {projectTab === 'dependencies' && <DependenciesView />}
                {/* Direct-link backwards compatibility for /members and /activity URLs to Settings sections */}
                {(projectTab === 'members' || projectTab === 'settings#members') && (
                  <ProjectSettingsView key={`${currentProject.id}-members`} initialSection="members" />
                )}
                {(projectTab === 'activity' || projectTab === 'settings#activity') && (
                  <ProjectSettingsView key={`${currentProject.id}-activity`} initialSection="activity" />
                )}
                {projectTab === 'settings' && (
                  <ProjectSettingsView key={currentProject.id} />
                )}
              </>
            )
          ) : activeRoute === '/my-tasks' ? (
            <MyTasksView onOpenCreateTask={() => setCreateTaskOpen(true)} />
          ) : activeRoute === '/projects' ? (
            <ProjectsView onOpenCreateProject={() => setCreateProjectOpen(true)} />
          ) : activeRoute === '/settings' ? (
            <SettingsView />
          ) : (
            <HomeView />
          )}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <TaskDetailsDrawer />
      <CreateTaskModal
        isOpen={createTaskOpen}
        initialDueDate={createTaskInitialDate}
        initialStartDate={createTaskInitialDate}
        onClose={() => {
          setCreateTaskOpen(false);
          setCreateTaskInitialDate(undefined);
        }}
      />
      <CreateSprintModal
        isOpen={createSprintOpen}
        onClose={() => setCreateSprintOpen(false)}
      />
      <CreateProjectModal
        isOpen={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
      />
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <ImpactPreviewModal />
      <ConflictModal />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainAppShell />
    </AppProvider>
  );
}
