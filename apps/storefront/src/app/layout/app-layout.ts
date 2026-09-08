import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthNav } from '@flux/auth';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, AuthNav],
  templateUrl: './app-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayout {}
