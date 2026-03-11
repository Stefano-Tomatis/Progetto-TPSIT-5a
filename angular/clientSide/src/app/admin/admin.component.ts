import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModuloHttpService } from '../modulo-http.service';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { ServiceDatiService } from '../service-dati.service';
import { Validators } from '@angular/forms';

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

  showModal = signal<boolean>(false);
  visitaInModifica = signal<any>(null);
  orariDisponibili = signal<any[]>([]);
  modificaForm: FormGroup;

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
    this.modificaForm = this.fb.group({
    nuovaData: ['', Validators.required],
    nuovoOra: ['', Validators.required]
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
          dottore_nome: v.Medico ? `${v.Medico.nome} ${v.Medico.cognome}` : 'N/A',
          idMedico: v.Medico?.id, 
          utenteDati: v.Utente    
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
  console.log("Dati visita selezionata:", visita);
  this.visitaInModifica.set(visita);
  this.showModal.set(true);
  
  this.modificaForm.reset();
  this.orariDisponibili.set([]);
  this.cdr.detectChanges();
}

onDataChange() {
  const data = this.modificaForm.get('nuovaData')?.value;
  const visita = this.visitaInModifica();
  const idMedico = visita?.idMedico;

  if (data && idMedico) {
    const d = new Date(data);
    if (d.getDay() === 0 || d.getDay() === 6) {
      alert("I weekend non sono giorni lavorativi!");
      this.modificaForm.get('nuovaData')?.setValue('');
      return;
    }

    this.http.getOrariDatoDottore(idMedico, data).subscribe({
      next: (res: any) => {
        const orari = res.data || res; 
        this.orariDisponibili.set(orari);        
        this.modificaForm.get('nuovoOra')?.setValue('');        
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Errore caricamento orari:", err);
        this.orariDisponibili.set([]);
      }
    });
  }
}

salvaModifica() {
  if (this.modificaForm.valid && this.visitaInModifica()) {
    const { nuovaData, nuovoOra } = this.modificaForm.value;
    const visita = this.visitaInModifica();

    const payload = {
      data: nuovaData,
      ora: nuovoOra,
      idVisita: visita.id 
    };

    console.log("Inviando modifica:", payload);

    this.http.updateVisita(payload).subscribe({
      next: (res: any) => {
        if (res.success) {
          alert("Appuntamento modificato con successo!");
          this.showModal.set(false);
          
          const idDoc = this.filtroForm.get('dottoreId')?.value;
          const idPaziente = this.filtroUtenteForm.get('pazienteId')?.value;
          
          if (idDoc) this.caricaVisite(Number(idDoc), 'doc');
          if (idPaziente) this.caricaVisite(Number(idPaziente), 'paz');
        }
      },
      error: (err) => {
        console.error("Errore durante il salvataggio:", err);
        alert("Errore nel salvataggio della modifica.");
      }
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
