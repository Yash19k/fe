import React, { useState, useEffect } from 'react';
import { AppProvider } from './state/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { useApp } from './hooks/useApp';
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
import { SprintDashboardView } from './features/project/SprintDashboardView';
import { WorkflowBuilderView } from './features/project/WorkflowBuilderView';
import { DependenciesView } from './features/project/DependenciesView';
import { WhiteboardsView } from './features/project/WhiteboardsView';
import { WhiteboardEditorView } from './features/project/WhiteboardEditorView';
import { ProjectSettingsView, SettingsSection } from './features/project/ProjectSettingsView';
import { SettingsView } from './features/settings/SettingsView';
import { AuthView } from './features/auth/AuthView';
import { CompanySetupView } from './features/onboarding/CompanySetupView';

import { ChatView } from './features/chat/ChatView';

import { NotFoundView } from './features/not-found/NotFoundView';


function isSettingsTab(tab: string): boolean {
  return (
    tab === 'settings' ||
    tab.startsWith('settings#') ||
    ['workflow', 'dependencies', 'members', 'activity', 'labels', 'danger', 'security', 'general'].includes(tab)
  );
}

function isValidProjectTab(tab: string): boolean {
  return (
    ['overview', 'dashboard', 'list', 'board', 'timeline', 'calendar', 'sprint', 'whiteboards'].includes(tab) ||
    isSettingsTab(tab)
  );
}

function getSettingsSectionFromTab(tab: string): SettingsSection {
  if (tab.includes('#')) {
    const sec = tab.split('#')[1];
    if (sec === 'security' || sec === 'danger') return 'danger';
    if (['general', 'members', 'workflow', 'dependencies', 'labels', 'activity'].includes(sec)) {
      return sec as SettingsSection;
    }
  }
  if (tab === 'workflow') return 'workflow';
  if (tab === 'dependencies') return 'dependencies';
  if (tab === 'members') return 'members';
  if (tab === 'activity') return 'activity';
  if (tab === 'labels') return 'labels';
  if (tab === 'danger' || tab === 'security') return 'danger';
  return 'general';
}

function MainAppShell() {
  const {
    activeRoute,
    projectTab,
    currentProjectId,
    currentProject,
    currentUser,
    currentWorkflow,
    navigate,
    isInitializingAuth,
    isLoadingProjectData,
  } = useApp();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('taskflow_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('taskflow_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskSprintId, setCreateTaskSprintId] = useState<string | undefined>();
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

  const isAuthenticated = Boolean(currentUser && currentUser.id && currentUser.email);

  // Sync route to /login if unauthenticated user attempts direct navigation to protected routes
  useEffect(() => {
    if (!isInitializingAuth && !isAuthenticated && activeRoute !== '/login' && activeRoute !== '/signup') {
      navigate('/login');
    }
  }, [isInitializingAuth, isAuthenticated, activeRoute, navigate]);

  // Auth views
  if (activeRoute === '/login') {
    return <AuthView isSignup={false} />;
  }
  if (activeRoute === '/signup') {
    return <AuthView isSignup={true} />;
  }

  // Loading state while verifying authentication session
  if (isInitializingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-text-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
          <span className="text-xs text-text-muted">Loading workspace...</span>
        </div>
      </div>
    );
  }

  // Route Guard: Block protected workspace screens when unauthenticated or signed out
  if (!isAuthenticated) {
    return <AuthView isSignup={false} />;
  }

  // Dedicated Company Setup & Onboarding Guard:
  // Render CompanySetupView if the user has not completed onboarding,
  // or is explicitly on the /onboarding/company route and has not completed setup.
  const needsOnboarding = Boolean(currentUser && currentUser.onboardingCompleted === false);
  if (needsOnboarding || (activeRoute === '/onboarding/company' && !currentUser?.onboardingCompleted)) {
    return <CompanySetupView />;
  }

  const routeProjectId = activeRoute.startsWith('/project/')
    ? (activeRoute.match(/^\/project\/([^/?#]+)/)?.[1] ?? '')
    : '';
  const effectiveProjectId = currentProjectId || routeProjectId;
  const isProjectRoute = activeRoute.startsWith('/project/') && Boolean(effectiveProjectId);
  const whiteboardEditorId = activeRoute.match(/^\/project\/[^/]+\/whiteboards\/([^/?#]+)/)?.[1];
  const hasProjectAccess = currentProject && currentUser?.id ? canUserAccessProject(currentProject, currentUser.id) : true;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-text-primary antialiased">
      {/* Consolidated Collapsible Sidebar */}
      <WorkspaceSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenCreateProject={() => setCreateProjectOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar
          onToggleSidebar={() => setSidebarOpen(true)}
          onOpenCreateTask={() => setCreateTaskOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={handleToggleSidebarCollapse}
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
              isLoadingProjectData ? (
                <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-canvas">
                  <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin mb-3" />
                  <span className="text-xs text-text-muted">Loading project...</span>
                </div>
              ) : (
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
              )
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
                {whiteboardEditorId ? (
                  <WhiteboardEditorView whiteboardId={whiteboardEditorId} />
                ) : projectTab === 'overview' && <ProjectOverviewView />}
                {/* Legacy /dashboard URL renders consolidated Overview (Req 2.5) */}
                {projectTab === 'dashboard' && <ProjectOverviewView />}
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
                {projectTab === 'sprint' && (
                  <SprintDashboardView
                    onOpenCreateSprint={() => setCreateSprintOpen(true)}
                    onOpenCreateTask={(sprintId) => {
                      setCreateTaskSprintId(sprintId);
                      setCreateTaskOpen(true);
                    }}
                  />
                )}
                {projectTab === 'whiteboards' && !whiteboardEditorId && <WhiteboardsView />}
                {/* Unified Project Settings & Subsection Navigation */}
                {isSettingsTab(projectTab) && (
                  <ProjectSettingsView
                    key={currentProject.id}
                    initialSection={getSettingsSectionFromTab(projectTab)}
                  />
                )}
                {!isValidProjectTab(projectTab) && <NotFoundView />}
              </>
            )
          ) : activeRoute === '/my-tasks' ? (
            <MyTasksView />
          ) : activeRoute === '/projects' ? (
            <ProjectsView onOpenCreateProject={() => setCreateProjectOpen(true)} />
          ) : activeRoute === '/settings' ? (
            <SettingsView />

          ) : activeRoute === '/chat' ? (
            <ChatView />
          ) : activeRoute === '/' || activeRoute === '' ? (

            <HomeView />
          ) : (
            <NotFoundView />
          )}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <TaskDetailsDrawer />
      <CreateTaskModal
        isOpen={createTaskOpen}
        initialDueDate={createTaskInitialDate}
        initialStartDate={createTaskInitialDate}
        initialSprintId={createTaskSprintId}
        onClose={() => {
          setCreateTaskOpen(false);
          setCreateTaskInitialDate(undefined);
          setCreateTaskSprintId(undefined);
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
    <ThemeProvider>
      <AppProvider>
        <MainAppShell />
      </AppProvider>
    </ThemeProvider>
  );
}
