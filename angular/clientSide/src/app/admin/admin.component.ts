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
  filtroUtenteForm: FormGroup; // Nuovo form
  
  dottori = signal<any[]>([]);
  utenti = signal<any[]>([]); // Nuovo signal utenti
  
  visiteDottore = signal<any[]>([]);
  visitePaziente = signal<any[]>([]); // Nuovo signal visite paziente

  constructor(
    private servizio:ServiceDatiService,
    private http: ModuloHttpService, 
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.filtroForm = this.fb.group({
      dottoreId: ['']
    });
    this.filtroUtenteForm = this.fb.group({ pazienteId: [''] });
  }

  ngOnInit(): void {
    // Caricamento Dottori (tua logica attuale)
    this.http.getDottori().subscribe({
      next: (res: any) => {
        const listaMappata = res.data.map((d: any) => ({
          id: d.id,
          display_name: `${d.nome} ${d.cognome}`
        }));
        this.dottori.set(listaMappata);
      }
    });

    // NUOVO: Caricamento Utenti
    this.http.getTuttiUtenti().subscribe({
      next: (res: any) => {
        const listaMappata = res.data.map((u: any) => ({
          id: u.id,
          display_name: `${u.nome} ${u.cognome}`
        }));
        this.utenti.set(listaMappata);
      }
    });

    // Ascolto combo dottori
    this.filtroForm.get('dottoreId')?.valueChanges.subscribe(id => {
      if (id) this.caricaVisite(Number(id), 'doc');
    });

    // NUOVO: Ascolto combo utenti
    this.filtroUtenteForm.get('pazienteId')?.valueChanges.subscribe(id => {
      if (id) this.caricaVisite(Number(id), 'paz');
    });
  }

  caricaVisite(id: number, tipo: 'doc' | 'paz') {
    if (tipo === 'doc') {
      this.http.getAllVisiteDottore(id).subscribe(res => {
        this.visiteDottore.set(res.data || res);
        this.cdr.detectChanges();
      });
    } else {
      // Nota: usa il metodo del servizio per le visite del paziente
      this.http.getVisitePazienteId(id).subscribe(
        res => {
        const datiRicevuti = Array.isArray(res) ? res : (res as any).data;
  
        this.visitePaziente.set(datiRicevuti || []);
        this.cdr.detectChanges();
      }    
    );
    }
  }

  // Modificato per sapere quale lista ricaricare dopo l'eliminazione
  eliminaVisita(idVisita: number, tipo: 'doc' | 'paz') {
    if (confirm("Eliminare definitivamente?")) {
      this.http.deleteVisita(idVisita).subscribe(() => {
        if (tipo === 'doc') {
          this.caricaVisite(this.filtroForm.get('dottoreId')?.value, 'doc');
        } else {
          this.caricaVisite(this.filtroUtenteForm.get('pazienteId')?.value, 'paz');
        }
      });
    }
  }
  
  modificaVisita(visita: any) {
    // Da implementare
    console.log("Modifica visita:", visita);
  const nuovaData = prompt("Inserisci nuova data (YYYY-MM-DD HH:mm):", visita.data_visita);
  
  if (nuovaData) {
    // 1. Inviamo la modifica al server
    this.http.updateVisita(visita.id, { data: nuovaData }).subscribe({
      next: () => {
        // 2. Dobbiamo capire quale tabella ricaricare
        const idDottore = this.filtroForm.get('dottoreId')?.value;
        const idPaziente = this.filtroUtenteForm.get('pazienteId')?.value;

        // Ricarichiamo la tabella dottore se c'è un id selezionato
        if (idDottore) {
          this.caricaVisite(Number(idDottore), 'doc');
        }
        
        // Ricarichiamo la tabella paziente se c'è un id selezionato
        if (idPaziente) {
          this.caricaVisite(Number(idPaziente), 'paz');
        }
        
        alert("Modifica salvata con successo!");
      },
      error: (err) => console.error("Errore durante l'update:", err)
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
  -Caricamento combo utenti X
  -Caricamento visite una volta selezionato l'utente
  -implementazione eliminazione visite
  */
 
 
 
}
