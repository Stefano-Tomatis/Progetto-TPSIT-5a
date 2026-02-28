import { Component } from '@angular/core';
import { NgForm, FormsModule } from '@angular/forms';

@Component({
  selector: 'user',
  imports: [FormsModule],
  templateUrl: './user.component.html',
  styleUrl: './user.component.css'
})
export class UserComponent {

  nuovaPrenotazione = { dottoreId: '', data: '', ora: '' };
  
  dottori = [
    { id: 1, nome: 'Dr. Rossi', specializzazione: 'Cardiologia' },
    { id: 2, nome: 'Dr.ssa Bianchi', specializzazione: 'Dermatologia' }
  ];

  // Generiamo gli slot dalle 09:00 alle 17:00
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

  visitePrenotate = [
    { id: 101, data: '2026-03-05', ora: '10:00', dottore: 'Dr. Rossi' }
  ];

  controllaDisponibilita() {
    if (this.nuovaPrenotazione.dottoreId && this.nuovaPrenotazione.data) {
      console.log("Chiamata al server per disponibilità...");
      
      // SIMULAZIONE: Se scegli il Dr. Rossi il 2026-03-05, le 10:00 sono occupate
      this.orariSlot.forEach(slot => {
        if (this.nuovaPrenotazione.dottoreId === '1' && slot.ora === '10:00') {
          slot.occupato = true;
        } else {
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
