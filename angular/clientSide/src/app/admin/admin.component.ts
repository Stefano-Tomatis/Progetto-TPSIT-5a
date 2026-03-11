import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModuloHttpService } from '../modulo-http.service';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { ServiceDatiService } from '../service-dati.service';

@Component({
  selector: 'admin',
  imports: [ReactiveFormsModule, CommonModule, DatePipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  filtroForm: FormGroup;
  dottori = signal<any[]>([]);
  visiteDottore = signal<any[]>([]);
  
  constructor(
    private servizio:ServiceDatiService,
    private http: ModuloHttpService, 
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.filtroForm = this.fb.group({
      dottoreId: ['']
    });
  }

  ngOnInit(): void {
    this.http.getDottori().subscribe({
        next: (res: any) => {
        const listaMappata = res.data.map((d: any) => ({
          id: d.id,
          display_name: `${d.nome} ${d.cognome}`
        }));
        this.dottori.set(listaMappata);
    },
    error: (err) => console.error('Errore caricamento dottori', err)
    });

    this.filtroForm.get('dottoreId')?.valueChanges.subscribe(idSelezionato => {
    if (idSelezionato) {
      this.caricaVisite(Number(idSelezionato));
    } else {
      this.visiteDottore.set([]); 
    }
  });
  }

  caricaVisite(idDottore: number) {
  this.http.getAllVisiteDottore(idDottore).subscribe({
    next: (res: any) => {
      const dati = res.data ? res.data : res;

      const visiteMappate = dati.map((v: any) => ({
        id: v.id,
        data_visita: v.data_visita,
        paziente_nome: v.paziente_nome || `${v.p_nome} ${v.p_cognome}`,
        paziente_email: v.paziente_email || v.email
      }));

      this.visiteDottore.set(visiteMappate);
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('Errore nel recupero visite:', err);
      this.visiteDottore.set([]);
    }
  });
}

  eliminaVisita(idVisita: number) {
    if (confirm("Sei sicuro di voler eliminare questa visita?")) {
      this.http.deleteVisita(idVisita).subscribe(() => {
        // Ricarica la lista dopo l'eliminazione
        const idAttuale = this.filtroForm.get('dottoreId')?.value;
        this.caricaVisite(idAttuale);
      });
    }
  }

  modificaVisita(visita: any) {
    // Da implementare
    console.log("Modifica visita:", visita);
    const nuovaData = prompt("Inserisci nuova data (YYYY-MM-DD HH:mm):", visita.data_visita);
    if (nuovaData) {
      this.http.updateVisita(visita.id, { data: nuovaData }).subscribe(() => {
        this.caricaVisite(this.filtroForm.get('dottoreId')?.value);
      });
    }
  }

  logout()
  {
    this.http.log_out().subscribe({
      next: (data)=>{
         console.log("Data ritornata dal logut: ",data)
         this.servizio.logOutAdmin()
      },
      error: (err) =>{
        console.log("Errore nel loguout: ", err)
      }
    })
  }
  


  /*
    -Caricamento combo dottori X
    -Caricamento visite una volta selezionato il dottore
    -implementazione eliminazione visite
    -Caricamento combo utenti
    -Caricamento visite una volta selezionato l'utente
    -implementazione eliminazione visite
  */



}
