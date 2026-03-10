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

  ngOnInit(): void {
    this.http.getDottori().subscribe({
      next: (data) => this.dottori.set(data),
      error: (err) => console.error('Errore caricamento dottori', err)
    });

    this.caricaVisiteUtente();
    
    this.form.valueChanges.subscribe(() => {
      this.controllaDisponibilita();
    });
  }

  caricaVisiteUtente() {
  this.http.getVisitePaziente().subscribe({
    next: (data) => {
      this.visitePrenotate.set(data);
      console.log(data)
      this.cdr.detectChanges(); // gestione zoneless
    },
    error: (err) => console.error('Errore nel caricamento visite:', err)
  });
}

  controllaDisponibilita() {
    const { dottoreId, data } = this.form.getRawValue();

    if (dottoreId && data) {
      console.log(`Richiedo orari per dottore ${dottoreId} in data ${data}`);
      
      this.http.getOrariDatoDottore(dottoreId, data).subscribe({
        next: (slots) => {
          this.orariSlot.set(slots);
          this.cdr.detectChanges();
        },
        error: (err) => console.error("Errore nel recupero slot", err)
      });
    }
  }

onSubmit() {
  if (this.form.valid) {
    const { dottoreId, data, ora } = this.form.value;    

    this.http.prenotaVisita(Number(dottoreId), data, ora).subscribe({
      next: (res) => {
        alert('Visita prenotata con successo!');
        this.form.reset();
        this.caricaVisiteUtente();
      },
      error: (err) => alert('Errore: slot probabilmente già occupato.')
    });
  }
}

  disdiciVisita(id: number) {
    this.visitePrenotate.update(v => v.filter(vis => vis.id !== id));
    //implementa la chiamata al server per eliminare la visita
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