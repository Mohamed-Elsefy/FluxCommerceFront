import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alert, Badge, Button, Card, Chip, Input, Skeleton, Spinner } from '@flux/ui';

/**
 * Design preview — Kinetic Bubble Neo visual checklist (`/design-preview`).
 * Dev-only review surface, not linked from the shell nav. Renders every
 * token-driven primitive in both themes so reviewers verify DESIGN §2–§10
 * without touching business pages.
 */
@Component({
  selector: 'app-design-preview-page',
  imports: [RouterLink, Alert, Badge, Button, Card, Chip, Input, Skeleton, Spinner],
  templateUrl: './design-preview-page.html',
  styleUrl: './design-preview-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignPreviewPage {}
