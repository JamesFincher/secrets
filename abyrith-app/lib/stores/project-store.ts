/**
 * Project Management Store
 *
 * Manages projects, environments, and organization state
 */

import { create } from 'zustand';
import { supabase } from '@/lib/api/supabase';
import type { Tables } from '@/lib/api/supabase';

type Project = Tables<'projects'>;
type Environment = Tables<'environments'>;
type Organization = Tables<'organizations'>;
type System = Tables<'systems'>;

interface ProjectState {
  organizations: Organization[];
  currentOrganization: Organization | null;
  projects: Project[];
  currentProject: Project | null;
  environments: Environment[];
  systems: System[];
  currentSystem: System | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentOrganization: (org: Organization) => void;
  setCurrentProject: (project: Project | null) => void;
  setCurrentSystem: (system: System | null) => void;
  loadOrganizations: (userId: string) => Promise<void>;
  loadProjects: (organizationId: string) => Promise<void>;
  loadEnvironments: (projectId: string) => Promise<void>;
  loadSystems: (projectId: string) => Promise<void>;
  createOrganization: (name: string, ownerId: string) => Promise<Organization>;
  createProject: (organizationId: string, name: string, description?: string) => Promise<Project>;
  createEnvironment: (projectId: string, name: string, slug: string) => Promise<Environment>;
  createSystem: (projectId: string, name: string, description?: string, icon?: string, color?: string) => Promise<System>;
  updateSystem: (systemId: string, updates: Partial<System>) => Promise<System>;
  deleteSystem: (systemId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  organizations: [],
  currentOrganization: null,
  projects: [],
  currentProject: null,
  environments: [],
  systems: [],
  currentSystem: null,
  isLoading: false,
  error: null,

  setCurrentOrganization: (org) => {
    set({ currentOrganization: org });
    if (org) {
      get().loadProjects(org.id);
    }
  },

  setCurrentProject: (project) => {
    set({ currentProject: project, currentSystem: null });
    if (project) {
      get().loadEnvironments(project.id);
      get().loadSystems(project.id);
    }
  },

  setCurrentSystem: (system) => {
    set({ currentSystem: system });
  },

  /**
   * Load all organizations for a user
   */
  loadOrganizations: async (userId: string) => {
    set({ isLoading: true, error: null });

    try {
      // Get organizations where user is a member
      const { data: memberships, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId);

      if (memberError) throw memberError;

      if (!memberships || memberships.length === 0) {
        set({ organizations: [], isLoading: false });
        return;
      }

      const orgIds = (memberships as any[]).map((m: any) => m.organization_id);

      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds);

      if (orgsError) throw orgsError;

      set({
        organizations: orgs || [],
        currentOrganization: orgs?.[0] || null,
        isLoading: false,
      });

      // Load projects for first org
      if (orgs?.[0]) {
        get().loadProjects((orgs as any[])[0].id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load organizations';
      set({ error: errorMessage, isLoading: false });
    }
  },

  /**
   * Load all projects for an organization
   */
  loadProjects: async (organizationId: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({
        projects: data || [],
        currentProject: data?.[0] || null,
        isLoading: false,
      });

      // Load environments for first project
      if (data?.[0]) {
        get().loadEnvironments((data as any[])[0].id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load projects';
      set({ error: errorMessage, isLoading: false });
    }
  },

  /**
   * Load all environments for a project
   */
  loadEnvironments: async (projectId: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('environments')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      set({ environments: data || [], isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load environments';
      set({ error: errorMessage, isLoading: false });
    }
  },

  /**
   * Create a new organization
   */
  createOrganization: async (name: string, ownerId: string) => {
    set({ isLoading: true, error: null });

    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Use database function to create organization and member atomically
      const { data: org, error: orgError } = await supabase
        .rpc('create_organization_with_member', {
          org_name: name,
          org_slug: slug,
          user_id: ownerId,
        })
        .single();

      if (orgError) throw orgError;

      set((state) => ({
        organizations: [...state.organizations, org],
        currentOrganization: org,
        isLoading: false,
      }));

      return org;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create organization';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Create a new project
   */
  createProject: async (organizationId: string, name: string, description?: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Use database function to create project and environments atomically
      const { data: project, error: projectError } = await supabase
        .rpc('create_project_with_environments', {
          p_organization_id: organizationId,
          p_name: name,
          p_description: description || '',
          p_created_by: user.id,
        })
        .single();

      if (projectError) throw projectError;

      set((state) => ({
        projects: [project, ...state.projects],
        currentProject: project,
        isLoading: false,
      }));

      // Load environments for new project
      await get().loadEnvironments(project.id);

      return project;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Create a new environment
   */
  createEnvironment: async (projectId: string, name: string, slug: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data: env, error } = await (supabase
        .from('environments') as any)
        .insert({
          project_id: projectId,
          name,
          slug,
          sort_order: get().environments.length,
        })
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        environments: [...state.environments, env],
        isLoading: false,
      }));

      return env;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create environment';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Load all systems for a project
   */
  loadSystems: async (projectId: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('systems')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      set({ systems: data || [], isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load systems';
      set({ error: errorMessage, isLoading: false });
    }
  },

  /**
   * Create a new system
   */
  createSystem: async (
    projectId: string,
    name: string,
    description?: string,
    icon?: string,
    color?: string
  ) => {
    set({ isLoading: true, error: null });

    try {
      const { data: system, error } = await (supabase
        .from('systems') as any)
        .insert({
          project_id: projectId,
          name,
          description,
          icon,
          color,
          sort_order: get().systems.length,
        })
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        systems: [...state.systems, system],
        isLoading: false,
      }));

      return system;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create system';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Update an existing system
   */
  updateSystem: async (systemId: string, updates: Partial<System>) => {
    set({ isLoading: true, error: null });

    try {
      const { data: system, error } = await (supabase
        .from('systems') as any)
        .update(updates)
        .eq('id', systemId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        systems: state.systems.map((s) => (s.id === systemId ? system : s)),
        currentSystem: state.currentSystem?.id === systemId ? system : state.currentSystem,
        isLoading: false,
      }));

      return system;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update system';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Delete a system
   */
  deleteSystem: async (systemId: string) => {
    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase.from('systems').delete().eq('id', systemId);

      if (error) throw error;

      set((state) => ({
        systems: state.systems.filter((s) => s.id !== systemId),
        currentSystem: state.currentSystem?.id === systemId ? null : state.currentSystem,
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete system';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },
}));
