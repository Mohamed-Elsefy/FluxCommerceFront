/**
 * Admin users list page for Supplement S1, Step S1.5 — Admin Users &
 * Permissions (list slice).
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `UsersListState` (route-provided `usersRoutes` entry — never a global
 * store), rendering the paged users table through the shared admin
 * primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * UsersListPage (this file — orchestration only)
 *     ↓ UsersListState (../state — paged slot + committed filters/page)
 *     ↓ IdentityApiService (@flux/api — GET /admin/users)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Identity API
 * ```
 *
 * Contract fidelity (S1.1 audit — only backend-exposed options):
 * `GET /admin/users` exposes paging plus `status`/`role`/`search`
 * (case-insensitive names, unknown → `400`), fixed newest-first — no
 * `sortBy`, no other filters. Filter commits reset to page 1; pager
 * values always come from the RESPONSE envelope (effective
 * `pageNumber`/`pageSize`/`totalCount`) with page counts from the
 * shared `totalPagesOf` helper. Status renders through the feature-owned
 * `UserStatusBadge` (localized label + tone, verbatim fallback for
 * unknown values); roles and permission counts render verbatim.
 *
 * Resource states: idle → loading → success | empty | error through the
 * shared primitives with localized copy and retry (out-of-range pages
 * arrive as `200` with `items: []` — the empty state, never an error).
 * Failures resolve through `resolveApiErrorMessage` (never backend
 * text). User emails deep-link to the details route through the
 * sanctioned per-column row links — every listed route exists, so no
 * dead links ship.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { ErrorState } from '@flux/ui';
import {
  AdminDataTable,
  type AdminDataColumn,
  type AdminDataRowContext,
} from '../../../../shared/data-table/data-table';
import { AdminFilterBar } from '../../../../shared/filters/filter-bar/filter-bar';
import { AdminSearchInput } from '../../../../shared/filters/search-input/search-input';
import { AdminSelect, type AdminSelectOption } from '../../../../shared/forms/select/select';
import {
  AdminPagination,
  type AdminPaginationCopy,
} from '../../../../shared/pagination/pagination';
import { UserStatusBadge } from '../../components/user-status-badge/user-status-badge';
import { UsersListState } from '../../state/users-list-state';
import type { UserAdminRow } from '../../models/users-admin.models';
import { USERS_TRANSLATION_KEYS, translateUsersKey } from '../../i18n/users-translations';

@Component({
  selector: 'app-users-list-page',
  imports: [
    ReactiveFormsModule,
    AdminDataTable,
    AdminFilterBar,
    AdminSearchInput,
    AdminSelect,
    AdminPagination,
    ErrorState,
    UserStatusBadge,
  ],
  templateUrl: './users-list-page.html',
  styleUrl: './users-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersListPage implements OnInit {
  private readonly users = inject(UsersListState);
  private readonly cultures = inject(CultureService);
  private readonly formBuilder = inject(FormBuilder);

  /** Status cell template (badge per row — resolved after view init). */
  private readonly statusCell =
    viewChild<TemplateRef<AdminDataRowContext<UserAdminRow>>>('statusCell');

  /** Current user page (idle → loading → success | empty | error). */
  protected readonly slot = this.users.page;

  /**
   * Filter form (search/status/role). Commits explicitly through Apply;
   * selects carry an empty All option (omitted server-side).
   */
  protected readonly filters = this.formBuilder.nonNullable.group({
    search: [''],
    status: [''],
    role: [''],
  });

  /** Whether the table body shows the loading state. */
  protected readonly tableLoading = computed(() => {
    const status = this.slot().status;
    return status === 'idle' || status === 'loading';
  });

  /** Localized table columns for the active culture. */
  protected readonly columns = computed((): readonly AdminDataColumn<UserAdminRow>[] => {
    const culture = this.cultures.culture();
    return [
      {
        key: 'email',
        header: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listColEmail),
        value: (row) => row.email,
        link: (row) => `/users/${row.id}`,
      },
      {
        key: 'name',
        header: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listColName),
        value: (row) => row.displayName ?? `${row.firstName} ${row.lastName}`.trim(),
      },
      {
        key: 'roles',
        header: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listColRoles),
        value: (row) => row.roles.join(', '),
      },
      {
        key: 'status',
        header: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listColStatus),
        value: (row) => String(row.status),
        template: this.statusCell() ?? null,
      },
      {
        key: 'locked',
        header: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listColLocked),
        value: (row) =>
          row.isLocked
            ? translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsVerifiedYes)
            : translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsVerifiedNo),
      },
    ];
  });

  /** Current page rows (`[]` until settled). */
  protected readonly rows = computed(() => this.slot().data?.items ?? []);

  /** Whether the pager renders (a settled page exists). */
  protected readonly showPager = computed(() => this.slot().data !== null);

  /** Localized status select options (All + backend status names). */
  protected readonly statusOptions = computed((): readonly AdminSelectOption[] => {
    const culture = this.cultures.culture();
    return [
      { value: '', label: translateUsersKey(culture, USERS_TRANSLATION_KEYS.filterAll) },
      { value: 'Pending', label: translateUsersKey(culture, USERS_TRANSLATION_KEYS.statusPending) },
      { value: 'Active', label: translateUsersKey(culture, USERS_TRANSLATION_KEYS.statusActive) },
      {
        value: 'Suspended',
        label: translateUsersKey(culture, USERS_TRANSLATION_KEYS.statusSuspended),
      },
      { value: 'Locked', label: translateUsersKey(culture, USERS_TRANSLATION_KEYS.statusLocked) },
      { value: 'Deleted', label: translateUsersKey(culture, USERS_TRANSLATION_KEYS.statusDeleted) },
    ];
  });

  /** Localized role select options (All + backend role names verbatim). */
  protected readonly roleOptions = computed((): readonly AdminSelectOption[] => {
    const culture = this.cultures.culture();
    return [
      { value: '', label: translateUsersKey(culture, USERS_TRANSLATION_KEYS.filterAll) },
      { value: 'Customer', label: 'Customer' },
      { value: 'Admin', label: 'Admin' },
      { value: 'SuperAdmin', label: 'SuperAdmin' },
    ];
  });

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listHeading),
      subheading: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listSubheading),
      caption: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listCaption),
      loading: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listLoading),
      emptyTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listEmptyTitle),
      emptyMessage: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listEmptyMessage),
      errorTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.listErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      filterTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.filterTitle),
      filterSearch: translateUsersKey(culture, USERS_TRANSLATION_KEYS.filterSearch),
      filterSearchPlaceholder: translateUsersKey(
        culture,
        USERS_TRANSLATION_KEYS.filterSearchPlaceholder,
      ),
      filterStatus: translateUsersKey(culture, USERS_TRANSLATION_KEYS.filterStatus),
      filterRole: translateUsersKey(culture, USERS_TRANSLATION_KEYS.filterRole),
      filterClear: translateUsersKey(culture, USERS_TRANSLATION_KEYS.filterClear),
      filterApply: translateUsersKey(culture, USERS_TRANSLATION_KEYS.filterApply),
    };
  });

  /** Localized pager copy for the active culture. */
  protected readonly pagerCopy = computed((): AdminPaginationCopy => {
    const culture = this.cultures.culture();
    return {
      label: translateUsersKey(culture, USERS_TRANSLATION_KEYS.paginationLabel),
      first: translateUsersKey(culture, USERS_TRANSLATION_KEYS.paginationFirst),
      previous: translateUsersKey(culture, USERS_TRANSLATION_KEYS.paginationPrevious),
      next: translateUsersKey(culture, USERS_TRANSLATION_KEYS.paginationNext),
      last: translateUsersKey(culture, USERS_TRANSLATION_KEYS.paginationLast),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    this.users.load();
  }

  /** Commits the filter form (resets to page 1). */
  protected applyFilters(): void {
    const raw = this.filters.getRawValue();
    this.users.setFilters({ status: raw.status, role: raw.role, search: raw.search });
  }

  /** Clears the filter form and reloads unfiltered. */
  protected clearFilters(): void {
    this.filters.reset({ search: '', status: '', role: '' });
    this.users.setFilters({});
  }

  /** Commits a pager move (response-effective values re-render the pager). */
  protected onPageChange(pageNumber: number): void {
    this.users.setPage(pageNumber);
  }

  /** List retry re-enters the current effective page. */
  protected retry(): void {
    this.users.reload();
  }
}
