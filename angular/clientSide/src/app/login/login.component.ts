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


  /*
    ricordati di fare il service di mezzo per poter segnalare i vari login
  */ 

  onSubmit() {
    if (this.form.valid) {
      const tipologiaSelezionata = this.form.get('tipologia')?.value;
      switch (tipologiaSelezionata) {
      case 'Admin':
        this.http.loginAsAdmin(this.form.value).subscribe({
          next: (data) =>{
            console.log("Login effettuato con successo")
            console.log(data)
            this.DS.loginAdmin()
          },
          error: (err) =>
          {
            console.log("Errore durante il login")
            console.log(err)            
          }
        })

        break;
      case 'Medico':
          this.http.loginAsDoctor(this.form.value).subscribe({
          next: (data) =>{
            console.log("Login effettuato con successo")
            console.log(data)
            this.DS.loginDoctor()
          },
          error: (err) =>
          {
            console.log("Errore durante il login")
            console.log(err)
          }
        })
        break;
      case 'User':
          this.http.loginAsUser(this.form.value).subscribe({
          next: (data) =>{
            console.log("Login effettuato con successo")
            console.log(data)
            this.DS.loginUser()
          },
          error: (err) =>
          {
            console.log("Errore durante il login")
            console.log(err)
          }
        })
        break;
      default:
        console.warn("Tipologia non riconosciuta");
      }
      
    } else {
      this.form.markAllAsTouched();
    }
  }
}