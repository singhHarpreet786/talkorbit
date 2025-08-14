import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  scrolled = false;

  visible = false;
  open(): void {
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  change(value: boolean): void {
    console.log(value);
  }
  onScroll(event: Event): void {
    // Check if the scroll offset is greater than a specific value (e.g., 50)
    this.scrolled = (event.target as HTMLElement).scrollTop > 50;
  }
}
