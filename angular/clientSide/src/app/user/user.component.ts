import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModuloHttpService } from '../modulo-http.service';
import { CommonModule } from '@angular/common';
import { ServiceDatiService } from '../service-dati.service';

@Component({
  selector: 'user',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './user.component.html',
  styleUrl: './user.component.css'
})
export class UserComponent implements OnInit {
  form: FormGroup;

  showModal = signal<boolean>(false);
  visitaInModifica = signal<any>(null);
  orariDisponibili = signal<any[]>([]);
  modificaForm: FormGroup;
  
  dottori = signal<any[]>([]);
  specializzazioni = signal<any[]>([]);
  orariSlot = signal<any[]>([]);

  visitePaziente = signal<any[]>([]); 
  
  visitePrenotate = signal([
    { id: 101, data: '2026-03-05', ora: '10:00', dottore: 'Dr. Rossi' } //da rimuovere
  ]);

  constructor(
    private servizio: ServiceDatiService,
    private http: ModuloHttpService, 
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef  ) 
    {
    this.form = this.fb.group({
      specializzazione: ['', Validators.required],
      dottoreId: ['', Validators.required],
      data: ['', Validators.required],
      ora: ['', Validators.required]
    });
    this.modificaForm = this.fb.group({
    nuovaData: ['', Validators.required],
    nuovoOra: ['', Validators.required]
  });
  }

  isGiornoOk:boolean=true

  ngOnInit(): void {
    /*this.http.getDottori().subscribe({
    next: (res: any) => {
      const listaMappata = res.data.map((d: any) => ({
        id: d.id,
        display_name: `${d.nome} ${d.cognome}`
      }));
      this.dottori.set(listaMappata);
    },
    error: (err) => console.error('Errore caricamento dottori', err)
  });*/

  this.http.getSpecializzazioni().subscribe({
    next: (res: any) => {
      const listaMappata = res.data.map((d: any) => ({
        id: d.IdSpecializzazione,
        nome: `${d.Nome}`
      }));
      this.dottori.set(listaMappata);
    },
    error: (err) => console.error('Errore caricamento specializzazioni', err)
  })

  this.caricaVisiteUtente();

    this.caricaVisiteUtente();


    
    this.form.valueChanges.subscribe(() => {
      this.controllaDisponibilita();
    });
  }

  caricaVisiteUtente() {
  this.http.getVisitePaziente().subscribe({
    next: (res: any) => {
      const visiteMappate = res.data.map((v: any) => {
        const d = new Date(v.DataOrario);
        return {
          id: v.IdVisita,
          data: d.toLocaleDateString(),
          ora: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dottore: `Dott. ${v.Medico.nome} ${v.Medico.cognome}`,
          idDottore: v.Medico.id
        };
      });
      this.visitePrenotate.set(visiteMappate);
      this.cdr.detectChanges();
    },
    error: (err) => console.error('Errore nel caricamento visite:', err)
  });
}

 controllaDisponibilita() {
  const { dottoreId, data } = this.form.getRawValue();

  if (dottoreId && data) {
    this.http.getOrariDatoDottore(dottoreId, data).subscribe({
      next: (res: any) => {
        if (res && res.data) {
          const slotsMappati = res.data.map((s: string) => ({
            ora: s, 
            occupato: false
          }));
          
          this.orariSlot.set(slotsMappati);
          console.log("Slot mappati correttamente:", slotsMappati);
        } else {
          this.orariSlot.set([]);
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error("Errore nel recupero slot", err)
    });
  }
}

onSubmit() {
  if (this.form.valid) {
    const { dottoreId, data, ora } = this.form.value;    
    
    const dataSelezionata = new Date(data);
    const giornoSettimana = dataSelezionata.getDay(); 

    const isWeekend = (giornoSettimana === 0 || giornoSettimana === 6);

    if (isWeekend) {
      alert('Errore: Non è possibile prenotare visite durante il weekend');
      return; 
    }

    this.http.prenotaVisita(Number(dottoreId), data, ora).subscribe({
      next: (res) => {
        alert('Visita prenotata con successo!');
        this.form.reset();
        this.caricaVisiteUtente();
      },
      error: (err) => alert('Inserimento della prenotazione fallito')
    });
  }
}

  disdiciVisita(id: number) {
    this.visitePrenotate.update(v => v.filter(vis => vis.id !== id));
    //implementa la chiamata al server per eliminare la visita

    this.http.deleteVisita(id).subscribe({
      next: (res) => {
        console.log("Visita eliminata con successo")
        this.form.reset();
        this.caricaVisiteUtente();
      },
      error: (err) => console.log('Errore a eliminare la visita')
    });

  }

  onLogout()
  {
    this.http.log_out().subscribe({
      next: (data)=>{
         console.log("Data ritornata dal logut: ",data)
         this.servizio.logOutUser()
      },
      error: (err) =>{
        console.log("Errore nel loguout: ", err)
      }
    })
  }

  modificaVisita(visita: any) {
  console.log("Dati visita selezionata:", visita);
  this.visitaInModifica.set(visita);
  this.showModal.set(true);
  
  this.modificaForm.reset();
  this.orariDisponibili.set([]);
  this.cdr.detectChanges();
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
          
          //AGGIORNAMENTO VISITE
          this.caricaVisiteUtente();
        }
      },
      error: (err) => {
        console.error("Errore durante il salvataggio:", err);
        alert("Errore nel salvataggio della modifica.");
      }
    });
  }
}

onDataChange() {
  const data = this.modificaForm.get('nuovaData')?.value;
  const visita = this.visitaInModifica();
  const idMedico = visita?.idDottore;

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
  else{
    console.log("Controlla id", data, visita, idMedico)
  }
}
}