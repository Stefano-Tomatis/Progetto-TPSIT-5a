import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModuloHttpService } from '../modulo-http.service';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable } from 'rxjs';

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
    private http: ModuloHttpService, 
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.filtroForm = this.fb.group({
      dottoreId: ['']
    });
  }

  ngOnInit(): void {
    // Carica la lista dei dottori per la combo
    this.http.getDottori().subscribe(data => this.dottori.set(data));

    // Quando l'admin cambia dottore, carica le sue visite
    this.filtroForm.get('dottoreId')?.valueChanges.subscribe(id => {
      if (id) {
        this.caricaVisite(id);
      } else {
        this.visiteDottore.set([]);
      }
    });
  }

  caricaVisite(idDottore: number) {
    this.http.getAllVisiteDottore(idDottore).subscribe(res => {
      this.visiteDottore.set(res);
      this.cdr.detectChanges();
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
    // Qui potresti aprire una modale o inviare a un form di modifica
    console.log("Modifica visita:", visita);
    const nuovaData = prompt("Inserisci nuova data (YYYY-MM-DD HH:mm):", visita.data_visita);
    if (nuovaData) {
      this.http.updateVisita(visita.id, { data: nuovaData }).subscribe(() => {
        this.caricaVisite(this.filtroForm.get('dottoreId')?.value);
      });
    }
  }
}
