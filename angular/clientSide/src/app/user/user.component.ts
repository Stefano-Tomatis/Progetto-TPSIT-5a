import { Component } from '@angular/core';
import { NgForm, FormsModule } from '@angular/forms';
import { NgModel } from '@angular/forms';
import { OnInit } from '@angular/core';
import { ModuloHttpService } from '../modulo-http.service';


@Component({
  selector: 'user',
  imports: [FormsModule,NgModel],
  templateUrl: './user.component.html',
  styleUrl: './user.component.css'
})
export class UserComponent implements OnInit {

  nuovaPrenotazione = { dottoreId: '', data: '', ora: '' };
  
  dottori:any = null;

  constructor(private http:ModuloHttpService)
  {}

  orariSlot = [
    { ora: '09:00', occupato: false },
    { ora: '10:00', occupato: false },
    { ora: '11:00', occupato: false },
    { ora: '12:00', occupato: false },
    { ora: '14:00', occupato: false },
    { ora: '15:00', occupato: false },
    { ora: '16:00', occupato: false },
    { ora: '17:00', occupato: false }
  ];

  ngOnInit(): void {
    this.http.getDottori().subscribe({
      next: (data) =>{
        this.dottori = data
        console.log('Dottori ricevuto: ', this.dottori)
      },
      error: (err) =>{
        console.log('Errore nella ricezione dei dottori', err)
      }
    })
  }

  /*
  per vedere quali slot sono occupati prova a:
  quando viene selezionato un dottore:
    -invio in get una richiesta al server con id dottore come parametro
    -il server estrae visite del dottore, osserva tra quelle quali fasce orarie lascia libere, resistuisce un array di fasce orarie marcando occupato = false / true
    -ricevuto l'array io vado a caricare dinamicamente la combobox
  */


  visitePrenotate = [
    { id: 101, data: '2026-03-05', ora: '10:00', dottore: 'Dr. Rossi' }
  ];

  controllaDisponibilita() {
    if (this.nuovaPrenotazione.dottoreId && this.nuovaPrenotazione.data) {
      console.log("Chiamata al server per disponibilità...");
      
      this.orariSlot.forEach(slot => {
        if (this.nuovaPrenotazione.dottoreId === '1' && slot.ora === '10:00') {
          slot.occupato = true;
        } else {    // da cambiare
          slot.occupato = false;
        }
      });
    }
  }

  onSubmit(form: any) {
    alert(`Prenotato con successo alle ${this.nuovaPrenotazione.ora}`);
    form.resetForm();
  }

  disdiciVisita(id: number) {
    this.visitePrenotate = this.visitePrenotate.filter(v => v.id !== id);
  }

  



}
