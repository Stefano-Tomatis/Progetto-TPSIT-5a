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
  filtroUtenteForm: FormGroup
  
  dottori = signal<any[]>([]);
  utenti = signal<any[]>([]); 
  
  visiteDottore = signal<any[]>([]);
  visitePaziente = signal<any[]>([]); 

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
    this.http.getDottori().subscribe({
      next: (res: any) => {
        const listaMappata = res.data.map((d: any) => ({
          id: d.id,
          display_name: `${d.nome} ${d.cognome}`
        }));
        this.dottori.set(listaMappata);
      }
    });

    this.http.getTuttiUtenti().subscribe({
      next: (res: any) => {
        const listaMappata = res.data.map((u: any) => ({
          id: u.id,
          display_name: `${u.nome} ${u.cognome}`
        }));
        this.utenti.set(listaMappata);
      }
    });

    this.filtroForm.get('dottoreId')?.valueChanges.subscribe(id => {
      if (id) this.caricaVisite(Number(id), 'doc');
    });

    this.filtroUtenteForm.get('pazienteId')?.valueChanges.subscribe(id => {
      if (id) this.caricaVisite(Number(id), 'paz');
    });
  }

  caricaVisite(id: number, tipo: 'doc' | 'paz') {
  const chiamata = tipo === 'doc' 
    ? this.http.getAllVisiteDottore(id) 
    : this.http.getVisitePazienteId(id);

  chiamata.subscribe({
    next: (res: any) => {
      const listaGrezza = res.data || [];

      const visiteMappate = listaGrezza.map((v: any) => ({
        id: v.IdVisita,
        data_visita: v.DataOrario,
        paziente_nome: v.Utente ? `${v.Utente.nome} ${v.Utente.cognome}` : 'N/A',
        paziente_email: v.Utente ? v.Utente.email : 'N/A',
        dottore_nome: v.Medico ? `${v.Medico.nome} ${v.Medico.cognome}` : 'N/A'
      }));

      if (tipo === 'doc') {
        this.visiteDottore.set(visiteMappate);
      } else {
        this.visitePaziente.set(visiteMappate);
      }
      
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error("Errore recupero dati:", err);
      tipo === 'doc' ? this.visiteDottore.set([]) : this.visitePaziente.set([]);
    }
  });
}

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
    console.log("Modifica visita:", visita);
    const nuovaData = prompt("Inserisci nuova data (YYYY-MM-DD HH:mm):", visita.data_visita);
    //da cambiare, sostituire il prompt con un modal che implementi una combo
    //la il modal dovra usare il servizio getFreeTime una volta selezionata la data da un calendario
    //e avere i controlli che non sia un weekend
  
  if (nuovaData) {
    this.http.updateVisita(visita.id, { data: nuovaData }).subscribe({
      next: () => {
        const idDottore = this.filtroForm.get('dottoreId')?.value;
        const idPaziente = this.filtroUtenteForm.get('pazienteId')?.value;

        if (idDottore) {
          this.caricaVisite(Number(idDottore), 'doc');
        }
        
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
  -Caricamento visite una volta selezionato il dottore X
  -implementazione eliminazione visite X
  -implementazione mdofica visite
  -Caricamento combo utenti X
  -Caricamento visite una volta selezionato l'utente X
  -implementazione eliminazione visite X
  -implementazione modifica visite
  */
 
 
 
}
