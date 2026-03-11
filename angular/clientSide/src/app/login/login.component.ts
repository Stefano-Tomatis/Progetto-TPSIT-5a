import { Component } from '@angular/core';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common'; 
import { ModuloHttpService } from '../modulo-http.service';
import { Observable } from 'rxjs';
import { ServiceDatiService } from '../service-dati.service';

@Component({
  selector: 'login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule], 
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  tipologie = ["Admin", "Medico", "User"];
  form: FormGroup;
  errorMessage: string | null = null;

  constructor(public DS: ServiceDatiService, private fb: FormBuilder, private http: ModuloHttpService) {
    this.form = this.fb.group({
      tipologia: ['', [Validators.required]],
      email: ['', [
        Validators.required, 
        Validators.email, 
        Validators.pattern("[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$")
      ]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }


  onSubmit() {
    this.errorMessage = null; 

    if (this.form.valid) {
      const tipologiaSelezionata = this.form.get('tipologia')?.value;
      
      const observer = {
        next: (data: any) => {
          console.log("Login effettuato con successo", data);
          if (tipologiaSelezionata === 'Admin') this.DS.loginAdmin();
          if (tipologiaSelezionata === 'Medico') this.DS.loginDoctor();
          if (tipologiaSelezionata === 'User') this.DS.loginUser();
        },
        error: (err: any) => {
          console.error("Errore durante il login", err);
          this.errorMessage = err.error?.message || "Credenziali non valide o errore di connessione.";
        }
      };

      switch (tipologiaSelezionata) {
        case 'Admin': this.http.loginAsAdmin(this.form.value).subscribe(observer); break;
        case 'Medico': this.http.loginAsDoctor(this.form.value).subscribe(observer); break;
        case 'User': this.http.loginAsUser(this.form.value).subscribe(observer); break;
        default: console.warn("Tipologia non riconosciuta");
      }
      
    } else {
      this.form.markAllAsTouched();
    }
  }
}