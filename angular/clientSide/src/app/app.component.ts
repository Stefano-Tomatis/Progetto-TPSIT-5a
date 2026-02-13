import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminComponent } from './admin/admin.component';
import { LoginComponent } from './login/login.component';
import { UserComponent } from './user/user.component';
import { DoctorComponent } from './doctor/doctor.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AdminComponent, LoginComponent, UserComponent, DoctorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'clientSide';
}
