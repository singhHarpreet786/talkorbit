import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  templateUrl: './app-logo.component.html',
  styleUrl: './app-logo.component.css'
})
export class AppLogoComponent {
 @Input() theme:string='dark';
 
}
