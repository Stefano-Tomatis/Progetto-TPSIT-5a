import { Component } from '@angular/core';
import { NgForm, FormsModule } from '@angular/forms';
import { NgStyle } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'login',
  imports: [FormsModule,NgStyle],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  tipologie=["Admin","Medico","User"]

  constructor(private http: HttpClient) { }  
  
  model = {
    tipologia:"",
    email:"",
    password:"",
  };

  onSubmit(form: NgForm)
  {
    if(form.valid && this.noRadio==false){
      console.log("MODEL:----------------------------");
      console.log(this.model);   
      const url = ' http://localhost:4656/'; // RICORDA L'INDIRIZZO

      this.http.post(url, this.model).subscribe({
        next: (response) => {
          console.log("Login effettuato", response);
        },
        error: (err) => {
          console.error("Errore durante il login", err);
          alert("Credenziali non valide o errore server");
        },
        complete: () => {
          console.log("Richiesta completata");
        }
      });
      

    }else{
      if(this.noRadio){
        this.visErrRadio=true;
      }
    }

  }

  visErrRadio:boolean = false;
  noRadio:boolean = true;

  onRadioChange(event:Event){
    this.noRadio=false;
    this.visErrRadio=false;
  }

}
