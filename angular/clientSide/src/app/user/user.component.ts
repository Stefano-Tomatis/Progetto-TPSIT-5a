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
  
  dottori = signal<any[]>([]);
  orariSlot = signal<any[]>([]);
  
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
      dottoreId: ['', Validators.required],
      data: ['', Validators.required],
      ora: ['', Validators.required]
    });
  }

  isGiornoOk:boolean=true

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
          dottore: `Dott. ${v.Medico.nome} ${v.Medico.cognome}`
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

}